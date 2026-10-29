import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { ApiError, request } from '@/services/api';

interface ResolvedAddress {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  displayName: string;
  line1?: string;
  locality?: string;
  lat?: number;
  lng?: number;
}

interface LocationSelectorProps {
  onResolved: (address: ResolvedAddress) => void | boolean | Promise<void | boolean>;
}

interface Coordinates {
  lat: number;
  lng: number;
}

const emptyAddress: ResolvedAddress = {
  city: '',
  district: '',
  state: '',
  pinCode: '',
  displayName: '',
  line1: '',
  locality: '',
};

export function LocationSelector({ onResolved }: LocationSelectorProps) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [preview, setPreview] = useState<ResolvedAddress | null>(null);
  const [manual, setManual] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const attemptId = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => () => {
    attemptId.current += 1;
    controller.current?.abort();
  }, []);

  function detectLocation() {
    if (requestInFlight.current) return;
    setPreview(null);
    setManual(false);
    setMessage('');
    setCanRetry(false);
    if (!navigator.geolocation) {
      setMessage('Location detection is unavailable in this browser. Enter your address manually.');
      setManual(true);
      return;
    }

    const currentAttempt = ++attemptId.current;
    requestInFlight.current = true;
    setBusy(true);
    setMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (currentAttempt !== attemptId.current) return;
        const position = { lat: coords.latitude, lng: coords.longitude };
        setCoordinates(position);
        setMessage('Resolving your address…');
        const currentController = new AbortController();
        controller.current = currentController;
        const timeoutId = window.setTimeout(() => currentController.abort(), 12_000);
        try {
          const result = await request<{ address: ResolvedAddress }>('/location/reverse-geocode', {
            method: 'POST',
            body: JSON.stringify({ latitude: position.lat, longitude: position.lng }),
            signal: currentController.signal,
          });
          if (currentAttempt !== attemptId.current) return;
          const address = result.address;
          setPreview({
            ...address,
            line1: address.line1 || address.displayName,
            locality: address.locality || address.city,
            lat: position.lat,
            lng: position.lng,
          });
          setMessage('Location found. Confirm your delivery address.');
          setCanRetry(false);
        } catch (error) {
          if (currentAttempt !== attemptId.current) return;
          setManual(true);
          setCanRetry(true);
          setMessage(error instanceof ApiError && error.code === 'LOCATION_INCOMPLETE_RESULT'
            ? 'We found your coordinates, but could not identify a complete address. Enter your locality and PIN code to continue.'
            : 'Couldn’t fetch your address automatically. Enter your PIN code and locality to continue.');
        } finally {
          window.clearTimeout(timeoutId);
          if (currentAttempt === attemptId.current) {
            controller.current = null;
            requestInFlight.current = false;
            setBusy(false);
          }
        }
      },
      (error) => {
        if (currentAttempt !== attemptId.current) return;
        requestInFlight.current = false;
        setBusy(false);
        setCanRetry(true);
        setManual(true);
        const errorCode = typeof error.code === 'number' ? error.code : -1;
        setMessage(
          errorCode === 1
            ? 'Location permission was denied. Enter your address manually or allow location access.'
            : errorCode === 3
              ? 'Location detection timed out. Try again or enter your address manually.'
              : errorCode === 2
                ? 'Your location is unavailable right now. Try again or enter your address manually.'
                : 'Location detection failed. Enter your address manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    );
  }

  async function confirmAddress() {
    if (!preview || saving || !/^\d{6}$/.test(preview.pinCode.trim())) return;
    const currentAttempt = attemptId.current;
    setSaving(true);
    setMessage('Saving your delivery address…');
    try {
      const saved = await onResolved({
        ...preview,
        pinCode: preview.pinCode.trim(),
        displayName: preview.line1?.trim() || preview.displayName,
      });
      if (currentAttempt !== attemptId.current) return;
      if (saved === false) {
        setMessage('This address could not be saved. Your previous delivery address is unchanged.');
      } else {
        setMessage(`Delivery address confirmed: ${preview.displayName || preview.locality || preview.city}.`);
        setPreview(null);
        setManual(false);
        setCoordinates(null);
      }
    } catch {
      if (currentAttempt === attemptId.current) {
        setMessage('This address could not be saved. Your previous delivery address is unchanged.');
      }
    } finally {
      if (currentAttempt === attemptId.current) setSaving(false);
    }
  }

  function updatePreview(field: keyof ResolvedAddress, value: string) {
    setPreview((current) => current ? { ...current, [field]: value } : current);
  }

  function startManualEntry() {
    setPreview((current) => current ?? {
      ...emptyAddress,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
    });
    setManual(true);
    setMessage('Enter your locality, state, and six-digit PIN code.');
  }

  return (
    <div className="space-y-3 rounded-xl border border-forest/10 bg-white/60 p-3">
      <p className="text-xs text-charcoal/65">
        Detect your location, review the address, then confirm to save it.
      </p>
      <button
        type="button"
        onClick={detectLocation}
        disabled={busy || saving}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-agri-green/10 px-3 text-sm font-semibold text-forest hover:bg-agri-green/15 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {busy ? 'Finding your location…' : canRetry ? 'Try location again' : 'Detect my location'}
      </button>
      {busy && <div className="h-2 w-full animate-pulse rounded bg-forest/10" aria-hidden="true" />}
      {message && <p className="text-xs text-charcoal/70" aria-live="polite">{message}</p>}

      {preview && (
        <div className="space-y-3 rounded-xl border border-agri-green/20 bg-white p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-forest">
            <MapPin className="h-4 w-4 text-agri-green" /> Confirm delivery address
          </p>
          <label className="block text-xs font-medium text-charcoal/70">
            House, flat, road or landmark
            <input
              value={preview.line1 || ''}
              onChange={(event) => updatePreview('line1', event.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-forest/15 bg-white px-3 text-sm text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-green"
              placeholder="Add house number or landmark (optional)"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs text-charcoal/70">
            <label>Locality
              <input value={preview.locality || preview.city} onChange={(event) => updatePreview('locality', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-forest/15 px-2 text-sm text-forest" />
            </label>
            <label>City
              <input value={preview.city} onChange={(event) => updatePreview('city', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-forest/15 px-2 text-sm text-forest" />
            </label>
            <label>District
              <input value={preview.district} onChange={(event) => updatePreview('district', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-forest/15 px-2 text-sm text-forest" />
            </label>
            <label>State
              <input value={preview.state} onChange={(event) => updatePreview('state', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-forest/15 px-2 text-sm text-forest" />
            </label>
            <label>PIN code
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={preview.pinCode}
                onChange={(event) => updatePreview('pinCode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="mt-1 min-h-10 w-full rounded-lg border border-forest/15 px-2 text-sm text-forest"
                aria-label="Confirm PIN code"
              />
            </label>
          </div>
          {!/^\d{6}$/.test(preview.pinCode.trim()) && (
            <p className="text-xs text-amber-800">Enter a valid six-digit PIN code before confirming.</p>
          )}
          <button
            type="button"
            onClick={() => void confirmAddress()}
            disabled={saving || !preview.city.trim() || !preview.district.trim() || !preview.state.trim() || !/^\d{6}$/.test(preview.pinCode.trim())}
            className="min-h-11 w-full rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-agri-green disabled:opacity-50"
          >
            {saving ? 'Saving address…' : 'Confirm and save address'}
          </button>
        </div>
      )}

      {manual && !preview && (
        <button type="button" onClick={startManualEntry} className="text-sm font-medium text-agri-green underline">
          Enter address manually
        </button>
      )}
      {manual && preview && (
        <button type="button" onClick={() => setPreview({ ...emptyAddress, lat: coordinates?.lat, lng: coordinates?.lng })} className="text-xs font-medium text-agri-green underline">
          Change address details
        </button>
      )}
      {coordinates && <span className="sr-only">Coordinates retained for manual address entry.</span>}
    </div>
  );
}
