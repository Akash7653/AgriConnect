import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface DeliveryLocationSummary {
  city: string;
  district: string;
  state: string;
  pinCode?: string;
}

function readGuestLocation(): DeliveryLocationSummary | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem('agriconnect-delivery-location') ?? 'null');
    if (
      typeof stored === 'object' &&
      stored !== null &&
      'city' in stored &&
      'district' in stored &&
      'state' in stored &&
      typeof stored.city === 'string' &&
      typeof stored.district === 'string' &&
      typeof stored.state === 'string'
    ) {
      return {
        city: stored.city,
        district: stored.district,
        state: stored.state,
        pinCode: 'pinCode' in stored && typeof stored.pinCode === 'string' ? stored.pinCode : '',
      };
    }
  } catch (error) {
    console.warn('Saved delivery location could not be read in the navigation.', error);
  }
  return null;
}

export function DeliveryLocationButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const guestLocation = readGuestLocation();
  const address = user?.address;
  const locationLabel = [
    address?.villageOrCity || guestLocation?.city,
    address?.district || guestLocation?.district,
    address?.state || guestLocation?.state,
  ].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={() => navigate('/shop', { state: { openDeliveryLocation: true } })}
      aria-label={`Change delivery location${locationLabel ? `: ${locationLabel}` : ''}`}
      className="flex min-w-0 max-w-[7rem] items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-ivory hover:bg-ivory/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agri-emerald min-[381px]:max-w-[6rem] min-[430px]:max-w-[9rem]"
    >
      <MapPin className="h-4 w-4 shrink-0 text-agri-emerald" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-[9px] font-semibold leading-tight text-ivory/80">Deliver to</span>
        <span className="block truncate text-[10px] font-medium leading-tight text-ivory">
          {locationLabel || 'Choose location'}
        </span>
      </span>
    </button>
  );
}
