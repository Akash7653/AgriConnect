import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { ApiError, request } from '@/services/api';

interface ResolvedAddress {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  displayName: string;
}

interface LocationSelectorProps {
  onResolved: (address: ResolvedAddress) => void | boolean | Promise<void | boolean>;
}

class IncompleteAddressError extends Error {}
class LocationSaveError extends Error {}

export function LocationSelector({ onResolved }: LocationSelectorProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const attemptId = useRef(0);

  useEffect(() => () => {
    attemptId.current += 1;
  }, []);

  function detectLocation() {
    if (!navigator.geolocation) {
      setMessage('Location detection is unavailable. Enter your address manually.');
      return;
    }

    const currentAttempt = ++attemptId.current;
    setBusy(true);
    setMessage('Requesting your location…');
    setCanRetry(false);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await request<{ address: ResolvedAddress }>('/location/reverse-geocode', {
            method: 'POST',
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          });
          if (currentAttempt !== attemptId.current) return;

          const address = result.address;
          if (!address.city || !address.state || !address.pinCode || !address.displayName) {
            throw new IncompleteAddressError();
          }

          const saved = await onResolved(address);
          if (saved === false) throw new LocationSaveError();
          if (currentAttempt === attemptId.current) {
            setMessage(`Delivery location updated to ${address.displayName}.`);
          }
        } catch (error) {
          if (currentAttempt === attemptId.current) {
            const friendlyMessage = error instanceof IncompleteAddressError
              ? 'We could not identify a complete delivery address. Enter your city and PIN code manually.'
              : error instanceof ApiError && error.code === 'LOCATION_INCOMPLETE_RESULT'
                ? 'We could not identify a complete delivery address. Enter your city and PIN code manually.'
              : error instanceof LocationSaveError
                ? 'This location could not be saved. Enter it manually or try again.'
                : 'Address lookup is temporarily unavailable. Enter your locality or PIN code manually, or try again.';
            setMessage(friendlyMessage);
            setCanRetry(true);
          }
        } finally {
          if (currentAttempt === attemptId.current) setBusy(false);
        }
      },
      (error) => {
        if (currentAttempt !== attemptId.current) return;
        setBusy(false);
        setCanRetry(true);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Enter your address manually.'
            : 'Location detection failed. Enter your address manually.'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-forest/10 bg-white/60 p-3">
      <p className="text-xs text-charcoal/55">
        Allow location access to automatically fill and save your delivery city and PIN code.
      </p>
      <button
        type="button"
        onClick={detectLocation}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-medium text-agri-green hover:text-forest disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {busy ? 'Updating delivery location…' : canRetry ? 'Try location again' : 'Use my current location'}
      </button>
      {message && <p className="text-xs text-charcoal/60" aria-live="polite">{message}</p>}
    </div>
  );
}
