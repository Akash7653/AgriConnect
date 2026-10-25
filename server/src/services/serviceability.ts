import { ServiceZone, IServiceZone } from '../models/ServiceZone.js';

export interface ServiceabilityAddress {
  city: string;
  state: string;
  pinCode: string;
}

export interface ServiceabilityResult {
  configured: boolean;
  serviceable: boolean | null;
  message: string;
  zone?: Pick<
    IServiceZone,
    '_id' | 'name' | 'city' | 'state' | 'deliveryFeePaise' |
    'freeDeliveryThresholdPaise' | 'estimatedDeliveryDays' | 'fulfilmentMethods'
  >;
}

export async function checkServiceability(address: ServiceabilityAddress): Promise<ServiceabilityResult> {
  const city = address.city.trim();
  const state = address.state.trim();
  const pinCode = address.pinCode.trim();
  const configuredZoneCount = await ServiceZone.countDocuments({ active: true });

  if (configuredZoneCount === 0) {
    return {
      configured: false,
      serviceable: null,
      message: 'Serviceability is not configured for this deployment yet.',
    };
  }

  const zone = await ServiceZone.findOne({
    active: true,
    city: { $regex: `^${escapeRegex(city)}$`, $options: 'i' },
    state: { $regex: `^${escapeRegex(state)}$`, $options: 'i' },
    postalCodes: pinCode,
  }).lean();

  if (!zone) {
    return {
      configured: true,
      serviceable: false,
      message: 'AgriConnect is not delivering to this location yet.',
    };
  }

  return {
    configured: true,
    serviceable: true,
    message: `Delivery is available in ${zone.name}.`,
    zone: {
      _id: zone._id,
      name: zone.name,
      city: zone.city,
      state: zone.state,
      deliveryFeePaise: zone.deliveryFeePaise,
      freeDeliveryThresholdPaise: zone.freeDeliveryThresholdPaise,
      estimatedDeliveryDays: zone.estimatedDeliveryDays,
      fulfilmentMethods: zone.fulfilmentMethods,
    },
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
