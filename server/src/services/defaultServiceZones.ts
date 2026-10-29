import { ServiceZone } from '../models/ServiceZone.js';

const telanganaPostalCodes = [
  '500001', '500002', '500003', '500004', '500005', '500006', '500007', '500008',
  '500010', '500012', '500013', '500016', '500018', '500020', '500028', '500032',
  '500035', '500038', '500039', '500044', '500048', '500050', '500060', '500072',
  '500081', '500082', '500084', '500090', '501401', '501503', '501510', '502001',
  '502032', '502103', '503001', '503002', '504001', '504002', '505001', '505527',
  '506001', '506002', '507001', '507002', '508001', '508101', '508207', '509001',
  '509301', '509321',
];

export async function ensureTelanganaServiceZone(): Promise<void> {
  const name = 'Telangana Statewide';
  const existing = await ServiceZone.exists({ name, state: 'Telangana' });
  if (existing) return;

  await ServiceZone.create({
    name,
    city: 'Telangana',
    state: 'Telangana',
    postalCodes: telanganaPostalCodes,
    postalCodePrefixes: ['500', '501', '502', '503', '504', '505', '506', '507', '508', '509'],
    active: true,
    deliveryFeePaise: 0,
    freeDeliveryThresholdPaise: 0,
    estimatedDeliveryDaysMin: 1,
    estimatedDeliveryDaysMax: 3,
    fulfilmentMethods: ['supplier_delivery'],
  });
}
