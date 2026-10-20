import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { request } from '@/services/api';

interface ResolvedAddress {
  city: string;
  district: string;
  state: string;
  pinCode: string;
  displayName: string;
}

interface LocationSelectorProps {
  onResolved: (address: ResolvedAddress) => void;
}

export function LocationSelector({ onResolved }: LocationSelectorProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [detectedAddress, setDetectedAddress] = useState<ResolvedAddress | null>(null);

  function detectLocation() {
    if (!navigator.geolocation) {
      setMessage('Location detection is unavailable. Enter your address manually.');
      return;
    }

    setBusy(true);
    setMessage('Requesting your location…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await request<{ address: ResolvedAddress }>('/location/reverse-geocode', {
            method: 'POST',
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          });
          setDetectedAddress(result.address);
          setMessage('Location found. Confirm it before continuing.');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Could not resolve this location. Enter it manually.');
        } finally {
          setBusy(false);
        }
      },
      (error) => {
        setBusy(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Enter your address manually.'
            : 'Location detection failed. Enter your address manually.'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  function confirmLocation() {
    if (!detectedAddress) return;
    onResolved(detectedAddress);
    setMessage(`Using ${detectedAddress.displayName}. You can still edit the fields below.`);
  }

  return (
    <div className="space-y-2 rounded-xl border border-forest/10 bg-white/60 p-3">
      <p className="text-xs text-charcoal/55">We use your location once to suggest a delivery city and PIN code. It is not saved until you confirm.</p>
      <button
        type="button"
        onClick={detectLocation}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-medium text-agri-green hover:text-forest disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {busy ? 'Detecting location…' : 'Detect my location'}
      </button>
      {detectedAddress && (
        <button
          type="button"
          onClick={confirmLocation}
          className="block w-full rounded-lg bg-agri-emerald/10 px-3 py-2 text-left text-sm text-forest hover:bg-agri-emerald/20"
        >
          <span className="font-medium">{detectedAddress.displayName}</span>
          <span className="mt-1 block text-xs text-charcoal/60">Use this address</span>
        </button>
      )}
      {message && <p className="text-xs text-charcoal/60" aria-live="polite">{message}</p>}
    </div>
  );
}
