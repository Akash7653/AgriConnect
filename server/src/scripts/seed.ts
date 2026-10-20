import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { USER_ROLES, ORDER_STATUSES, DEFAULT_PRICING_CONFIG } from '../config/constants.js';

async function ensureBudgetListing(): Promise<void> {
  const farmer = await User.findOne({ email: 'farmer@agriconnect.in' });
  if (!farmer) return;

  const farmerProfile = await FarmerProfile.findOne({ userId: farmer._id });
  if (!farmerProfile) return;

  await CropListing.updateOne(
    { cropName: 'Everyday Fresh Coriander' },
    {
      $setOnInsert: {
        farmerId: farmer._id,
        farmerProfileId: farmerProfile._id,
        cropName: 'Everyday Fresh Coriander',
        variety: 'Tender Green Bunch',
        category: 'Greens & Herbs',
        description: 'Fresh coriander bunch for everyday cooking, harvested and packed the same day.',
        images: ['https://images.unsplash.com/photo-1515586000433-45406d8e6662?auto=format&fit=crop&w=800&q=80'],
        qualityGrade: 'A',
        pricePerUnitPaise: 1000,
        unit: 'bunch',
        availableQuantity: 200,
        minOrderQuantity: 1,
        harvestDate: new Date(),
        expectedShelfLifeDays: 3,
        location: farmerProfile.location,
        isOrganicCertified: true,
        status: 'active',
        viewsCount: 0,
      },
    },
    { upsert: true }
  );
}

export async function seedDatabaseIfEmpty(): Promise<void> {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log(`Database already has ${userCount} users. Skipping seed.`);
    await ensureBudgetListing();
    return;
  }
  if (!process.env.SEED_PASSWORD) {
    console.warn('Seed skipped: configure SEED_PASSWORD to create local development accounts.');
    return;
  }
  await seedDatabase();
}

export async function seedDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed data is disabled in production.');
  }
  if (!process.env.SEED_PASSWORD) {
    throw new Error('SEED_PASSWORD is required to create local development accounts.');
  }

  console.log('Seeding AgriConnect database with realistic agricultural ecosystem data...');

  // 1. System Settings
  await SystemSettings.findOneAndUpdate(
    { key: 'global_config' },
    {
      farmerSharePct: DEFAULT_PRICING_CONFIG.farmerSharePct,
      platformCommissionPct: DEFAULT_PRICING_CONFIG.platformCommissionPct,
      opsReservePct: DEFAULT_PRICING_CONFIG.opsReservePct,
      defaultDeliveryFeePaise: DEFAULT_PRICING_CONFIG.defaultDeliveryFeePaise,
      freeDeliveryThresholdPaise: DEFAULT_PRICING_CONFIG.freeDeliveryThresholdPaise,
      enableAiAssistant: true,
      paymentGatewayMode: 'sandbox',
    },
    { upsert: true }
  );

  const salt = await bcrypt.genSalt(10);
  const commonPassword = await bcrypt.hash(process.env.SEED_PASSWORD, salt);

  // 2. Create Users
  // Admin
  const admin = await User.create({
    name: 'AgriConnect Administrator',
    email: 'admin@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.ADMIN,
    phone: '9848012345',
    language: 'en',
    isVerified: true,
    status: 'active',
  });

  // Farmers
  const farmer1 = await User.create({
    name: 'Nandhu Farmer (FPO Lead)',
    email: 'farmer@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.FARMER,
    phone: '9876543210',
    language: 'te',
    isVerified: true,
    status: 'active',
    address: {
      villageOrCity: 'Dharmavaram',
      district: 'Anantapur',
      state: 'Andhra Pradesh',
      pinCode: '515671',
    },
  });

  const farmer2 = await User.create({
    name: 'Ramesh Patel',
    email: 'ramesh.farmer@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.FARMER,
    phone: '9890123456',
    language: 'hi',
    isVerified: true,
    status: 'active',
    address: {
      villageOrCity: 'Lasalgaon',
      district: 'Nashik',
      state: 'Maharashtra',
      pinCode: '422306',
    },
  });

  const farmer3 = await User.create({
    name: 'Lakshmi Devi',
    email: 'lakshmi.farmer@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.FARMER,
    phone: '9440123456',
    language: 'te',
    isVerified: true,
    status: 'active',
    address: {
      villageOrCity: 'Narsampet',
      district: 'Warangal',
      state: 'Telangana',
      pinCode: '506132',
    },
  });

  // Household Buyer
  const buyer1 = await User.create({
    name: 'Priya Sharma',
    email: 'buyer@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.BUYER,
    phone: '9123456789',
    language: 'en',
    isVerified: true,
    status: 'active',
    address: {
      villageOrCity: 'Madhapur, Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500081',
    },
  });

  // B2B Business Buyer
  const business1 = await User.create({
    name: 'Chef Rajesh Kumar',
    email: 'business@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.BUSINESS,
    phone: '9822334455',
    language: 'en',
    isVerified: true,
    status: 'active',
    address: {
      villageOrCity: 'Banjara Hills, Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500034',
    },
  });

  // Logistics Partner
  const logistics1 = await User.create({
    name: 'Suresh Express Fleet',
    email: 'logistics@agriconnect.in',
    passwordHash: commonPassword,
    role: USER_ROLES.LOGISTICS,
    phone: '9700112233',
    language: 'en',
    isVerified: true,
    status: 'active',
  });

  // 3. Create Profiles
  const profileF1 = await FarmerProfile.create({
    userId: farmer1._id,
    farmName: 'Sri Balaji Organic & Horticulture Farms',
    fpoAffiliation: 'Rayalaseema Farmer Producer Organization',
    landSizeAcres: 12.5,
    primaryCrops: ['Tomatoes', 'Pomegranates', 'Chillies'],
    farmingPractice: 'organic',
    location: {
      village: 'Dharmavaram',
      district: 'Anantapur',
      state: 'Andhra Pradesh',
      pinCode: '515671',
    },
    kycDetails: {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy: admin._id,
    },
    bankDetails: {
      accountHolderName: 'Nandhu Farmer',
      accountNumber: '50100482910394',
      ifscCode: 'HDFC0001823',
      bankName: 'HDFC Bank',
      upiId: 'nandhufarm@oksbi',
    },
    rating: 4.9,
    totalOrdersFulfilled: 34,
  });

  const profileF2 = await FarmerProfile.create({
    userId: farmer2._id,
    farmName: 'Godavari Valley Onion & Agro Estates',
    fpoAffiliation: 'Nashik Krishi Vikas FPO',
    landSizeAcres: 20,
    primaryCrops: ['Nashik Onions', 'Grapes', 'Pomegranates'],
    farmingPractice: 'natural',
    location: {
      village: 'Lasalgaon',
      district: 'Nashik',
      state: 'Maharashtra',
      pinCode: '422306',
    },
    kycDetails: {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy: admin._id,
    },
    bankDetails: {
      accountHolderName: 'Ramesh Patel',
      accountNumber: '30291048291',
      ifscCode: 'SBIN0004921',
      bankName: 'State Bank of India',
      upiId: 'rameshpatel@okhdfcbank',
    },
    rating: 4.8,
    totalOrdersFulfilled: 62,
  });

  const profileF3 = await FarmerProfile.create({
    userId: farmer3._id,
    farmName: 'Kakatiya Natural Agro Fields',
    fpoAffiliation: 'Warangal Rythu Samakhya',
    landSizeAcres: 8.0,
    primaryCrops: ['Sona Masoori Rice', 'Turmeric', 'Cotton'],
    farmingPractice: 'organic',
    location: {
      village: 'Narsampet',
      district: 'Warangal',
      state: 'Telangana',
      pinCode: '506132',
    },
    kycDetails: {
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy: admin._id,
    },
    bankDetails: {
      accountHolderName: 'Lakshmi Devi',
      accountNumber: '62019482019',
      ifscCode: 'SBIN0020183',
      bankName: 'State Bank of India',
      upiId: 'lakshmifarm@icici',
    },
    rating: 4.95,
    totalOrdersFulfilled: 41,
  });

  // Buyer Profiles
  await BuyerProfile.create({
    userId: buyer1._id,
    buyerType: 'household',
    deliveryAddresses: [
      {
        label: 'Home Apartment',
        recipientName: 'Priya Sharma',
        phone: '9123456789',
        addressLine1: 'Flat 402, Green Valley Enclave, HITEC City',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pinCode: '500081',
        isDefault: true,
      },
    ],
  });

  await BuyerProfile.create({
    userId: business1._id,
    buyerType: 'restaurant',
    businessName: 'The Royal Deccan Restaurant & Caterers',
    gstNumber: '36AAAAA0000A1Z5',
    tradeLicense: 'GHMC-TL-2024-91823',
    deliveryAddresses: [
      {
        label: 'Main Commercial Kitchen',
        recipientName: 'Rajesh Kumar (Executive Chef)',
        phone: '9822334455',
        addressLine1: 'Plot 12, Road No 10, Banjara Hills',
        city: 'Hyderabad',
        district: 'Hyderabad',
        state: 'Telangana',
        pinCode: '500034',
        isDefault: true,
      },
    ],
    savedProcurementLists: [
      {
        name: 'Weekly Kitchen Staples',
        items: [
          { cropName: 'Tomatoes', preferredQuantity: 50, unit: 'kg' },
          { cropName: 'Nashik Red Onions', preferredQuantity: 60, unit: 'kg' },
          { cropName: 'Sona Masoori Rice', preferredQuantity: 100, unit: 'kg' },
        ],
      },
    ],
  });

  // 4. Crop Listings
  const crops = await CropListing.create([
    {
      farmerId: farmer1._id,
      farmerProfileId: profileF1._id,
      cropName: 'Kolar Fresh Hybrid Tomatoes',
      variety: 'Saaho 3251',
      category: 'Vegetables',
      description: 'Firm, naturally ripened red tomatoes harvested this morning. High pulp ratio, ideal for culinary cooking and salads with 7-day shelf life.',
      images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A+',
      pricePerUnitPaise: 3800, // ₹38.00 / kg
      unit: 'kg',
      availableQuantity: 450,
      minOrderQuantity: 1,
      harvestDate: new Date(),
      expectedShelfLifeDays: 7,
      location: profileF1.location,
      isOrganicCertified: true,
      status: 'active',
      viewsCount: 142,
    },
    {
      farmerId: farmer2._id,
      farmerProfileId: profileF2._id,
      cropName: 'Nashik Premium Red Onions',
      variety: 'Garwa Dark Red',
      category: 'Vegetables',
      description: 'World-renowned dry-cured Nashik red onions with thick pungent layers, excellent pungency and 60-day storage durability.',
      images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A',
      pricePerUnitPaise: 3200, // ₹32.00 / kg
      unit: 'kg',
      availableQuantity: 1200,
      minOrderQuantity: 1,
      harvestDate: new Date(Date.now() - 2 * 86400000),
      expectedShelfLifeDays: 45,
      location: profileF2.location,
      isOrganicCertified: false,
      status: 'active',
      viewsCount: 210,
    },
    {
      farmerId: farmer3._id,
      farmerProfileId: profileF3._id,
      cropName: 'Aged Sona Masoori Raw Rice',
      variety: 'BPT 5204 (12-Month Old)',
      category: 'Grains & Cereals',
      description: 'Naturally aged single-origin aromatic raw rice grown with river Godavari canal irrigation. Cooks fluffy and non-sticky.',
      images: ['https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A+',
      pricePerUnitPaise: 6400, // ₹64.00 / kg
      unit: 'kg',
      availableQuantity: 2500,
      minOrderQuantity: 1,
      harvestDate: new Date(Date.now() - 30 * 86400000),
      expectedShelfLifeDays: 365,
      location: profileF3.location,
      isOrganicCertified: true,
      status: 'active',
      viewsCount: 312,
    },
    {
      farmerId: farmer1._id,
      farmerProfileId: profileF1._id,
      cropName: 'Guntur Teja Hot Red Chilli',
      variety: 'Teja S17',
      category: 'Spices',
      description: 'Deep red, sun-dried pungent chillies with high capsaicin content and natural aroma, directly from Andhra chilli belt.',
      images: ['https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A',
      pricePerUnitPaise: 23500, // ₹235.00 / kg
      unit: 'kg',
      availableQuantity: 300,
      minOrderQuantity: 1,
      harvestDate: new Date(Date.now() - 5 * 86400000),
      expectedShelfLifeDays: 180,
      location: profileF1.location,
      isOrganicCertified: false,
      status: 'active',
      viewsCount: 95,
    },
    {
      farmerId: farmer2._id,
      farmerProfileId: profileF2._id,
      cropName: 'Ratnagiri Devgad Alphonso Mangoes',
      variety: 'Hapus GI Tagged',
      category: 'Fruits',
      description: 'Naturally grass-ripened Alphonso mangoes with rich saffron pulp and authentic aroma. Export quality box of 12 pieces.',
      images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A+',
      pricePerUnitPaise: 88000, // ₹880.00 / box
      unit: 'box',
      availableQuantity: 80,
      minOrderQuantity: 1,
      harvestDate: new Date(),
      expectedShelfLifeDays: 8,
      location: profileF2.location,
      isOrganicCertified: true,
      status: 'active',
      viewsCount: 420,
    },
    {
      farmerId: farmer3._id,
      farmerProfileId: profileF3._id,
      cropName: 'Farm Fresh Organic Palak (Spinach)',
      variety: 'All Green Broad Leaf',
      category: 'Greens & Herbs',
      description: 'Zero pesticide chemical-free spinach harvested at dawn. Crispy tender leaves packed with natural iron and vitamins.',
      images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A',
      pricePerUnitPaise: 2500, // ₹25.00 / bunch
      unit: 'bunch',
      availableQuantity: 150,
      minOrderQuantity: 1,
      harvestDate: new Date(),
      expectedShelfLifeDays: 3,
      location: profileF3.location,
      isOrganicCertified: true,
      status: 'active',
      viewsCount: 160,
    },
    {
      farmerId: farmer1._id,
      farmerProfileId: profileF1._id,
      cropName: 'Everyday Fresh Coriander',
      variety: 'Tender Green Bunch',
      category: 'Greens & Herbs',
      description: 'Fresh coriander bunch for everyday cooking, harvested and packed the same day.',
      images: ['https://images.unsplash.com/photo-1515586000433-45406d8e6662?auto=format&fit=crop&w=800&q=80'],
      qualityGrade: 'A',
      pricePerUnitPaise: 1000, // ₹10.00 / bunch
      unit: 'bunch',
      availableQuantity: 200,
      minOrderQuantity: 1,
      harvestDate: new Date(),
      expectedShelfLifeDays: 3,
      location: profileF1.location,
      isOrganicCertified: true,
      status: 'active',
      viewsCount: 0,
    },
  ]);

  // 5. Seed Real Orders & Transparent Payout Ledgers
  const order1 = await Order.create({
    orderNumber: 'AGC-918234-1021',
    buyerId: buyer1._id,
    buyerName: buyer1.name,
    buyerRole: buyer1.role,
    buyerPhone: buyer1.phone,
    items: [
      {
        listingId: crops[0]._id,
        cropName: crops[0].cropName,
        variety: crops[0].variety,
        unit: crops[0].unit,
        quantity: 5,
        unitPricePaise: crops[0].pricePerUnitPaise,
        totalPaise: crops[0].pricePerUnitPaise * 5, // ₹190.00
        farmerId: farmer1._id,
        farmerName: farmer1.name,
        farmLocation: 'Dharmavaram, Anantapur',
        qualityGrade: 'A+',
      },
      {
        listingId: crops[1]._id,
        cropName: crops[1].cropName,
        variety: crops[1].variety,
        unit: crops[1].unit,
        quantity: 5,
        unitPricePaise: crops[1].pricePerUnitPaise,
        totalPaise: crops[1].pricePerUnitPaise * 5, // ₹160.00
        farmerId: farmer2._id,
        farmerName: farmer2.name,
        farmLocation: 'Lasalgaon, Nashik',
        qualityGrade: 'A',
      },
    ],
    pricing: {
      grossProductValuePaise: 35000, // ₹350.00
      farmerPayoutPaise: 31500, // 90% = ₹315.00
      platformCommissionPaise: 2800, // 8% = ₹28.00
      operationsReservePaise: 700, // 2% = ₹7.00
      deliveryFeePaise: 4000, // ₹40.00
      finalPayablePaise: 39000, // ₹390.00
    },
    deliveryAddress: {
      recipientName: 'Priya Sharma',
      phone: '9123456789',
      addressLine1: 'Flat 402, Green Valley Enclave, HITEC City',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500081',
    },
    deliverySlot: {
      date: new Date().toISOString().split('T')[0],
      timeWindow: '07:00 AM - 11:00 AM',
    },
    status: ORDER_STATUSES.OUT_FOR_DELIVERY,
    statusHistory: [
      { status: ORDER_STATUSES.CONFIRMED, note: 'Order placed & paid via UPI Sandbox', timestamp: new Date(Date.now() - 3600000 * 4) },
      { status: ORDER_STATUSES.ACCEPTED, note: 'Farmer accepted and verified batch freshness', timestamp: new Date(Date.now() - 3600000 * 3) },
      { status: ORDER_STATUSES.READY_FOR_PICKUP, note: 'Crated and packed in breathable farm containers', timestamp: new Date(Date.now() - 3600000 * 2) },
      { status: ORDER_STATUSES.PICKED_UP, note: 'Picked up by Suresh Express Fleet', timestamp: new Date(Date.now() - 3600000 * 1) },
      { status: ORDER_STATUSES.OUT_FOR_DELIVERY, note: 'Transit in temperature controlled vehicle', timestamp: new Date() },
    ],
    payment: {
      status: 'captured',
      gateway: 'upi_instant',
      transactionId: 'TXN-UPI-98129038',
      paidAt: new Date(Date.now() - 3600000 * 4),
    },
    logistics: {
      assignedPartnerId: logistics1._id,
      partnerName: logistics1.name,
      partnerPhone: logistics1.phone,
      pickupTime: new Date(Date.now() - 3600000 * 1),
    },
  });

  // Payout ledgers for Order 1
  await PayoutLedger.create([
    {
      orderId: order1._id,
      orderNumber: order1.orderNumber,
      farmerId: farmer1._id,
      farmerName: farmer1.name,
      grossProductValuePaise: 19000,
      farmerSharePct: 90,
      farmerPayoutPaise: 17100, // ₹171.00
      platformCommissionPaise: 1520, // ₹15.20
      operationsReservePaise: 380, // ₹3.80
      settlementStatus: 'accrued',
      bankAccountLast4: '0394',
      upiId: 'nandhufarm@oksbi',
    },
    {
      orderId: order1._id,
      orderNumber: order1.orderNumber,
      farmerId: farmer2._id,
      farmerName: farmer2.name,
      grossProductValuePaise: 16000,
      farmerSharePct: 90,
      farmerPayoutPaise: 14400, // ₹144.00
      platformCommissionPaise: 1280, // ₹12.80
      operationsReservePaise: 320, // ₹3.20
      settlementStatus: 'accrued',
      bankAccountLast4: '8291',
      upiId: 'rameshpatel@okhdfcbank',
    },
  ]);

  // B2B Bulk Order (Delivered & Settled)
  const order2 = await Order.create({
    orderNumber: 'AGC-849102-9481',
    buyerId: business1._id,
    buyerName: business1.name,
    buyerRole: business1.role,
    buyerPhone: business1.phone,
    items: [
      {
        listingId: crops[2]._id,
        cropName: crops[2].cropName,
        variety: crops[2].variety,
        unit: crops[2].unit,
        quantity: 100,
        unitPricePaise: crops[2].pricePerUnitPaise,
        totalPaise: crops[2].pricePerUnitPaise * 100, // ₹6,400.00
        farmerId: farmer3._id,
        farmerName: farmer3.name,
        farmLocation: 'Narsampet, Warangal',
        qualityGrade: 'A+',
      },
    ],
    pricing: {
      grossProductValuePaise: 640000, // ₹6,400.00
      farmerPayoutPaise: 576000, // 90% = ₹5,760.00
      platformCommissionPaise: 51200, // 8% = ₹512.00
      operationsReservePaise: 12800, // 2% = ₹128.00
      deliveryFeePaise: 0, // Bulk order > ₹500 free delivery
      finalPayablePaise: 640000,
    },
    deliveryAddress: {
      recipientName: 'Chef Rajesh Kumar',
      phone: '9822334455',
      addressLine1: 'The Royal Deccan Restaurant, Banjara Hills',
      city: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500034',
    },
    deliverySlot: {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      timeWindow: '06:00 AM - 09:00 AM',
    },
    status: ORDER_STATUSES.DELIVERED,
    statusHistory: [
      { status: ORDER_STATUSES.CONFIRMED, note: 'B2B order confirmed via Corporate NetBanking', timestamp: new Date(Date.now() - 86400000 * 2) },
      { status: ORDER_STATUSES.DELIVERED, note: 'Delivered and accepted at hotel kitchen dock', timestamp: new Date(Date.now() - 86400000) },
    ],
    payment: {
      status: 'captured',
      gateway: 'razorpay_sandbox',
      transactionId: 'TXN-RAZ-5591823',
      paidAt: new Date(Date.now() - 86400000 * 2),
    },
    logistics: {
      assignedPartnerId: logistics1._id,
      partnerName: logistics1.name,
      partnerPhone: logistics1.phone,
      deliveredTime: new Date(Date.now() - 86400000),
      proofOfDelivery: {
        otpVerified: true,
        recipientSignature: 'Chef Rajesh Kumar',
        notes: '10 bags of 10kg Sona Masoori Rice received in airtight dry bags.',
      },
    },
  });

  // Settled payout ledger
  await PayoutLedger.create({
    orderId: order2._id,
    orderNumber: order2.orderNumber,
    farmerId: farmer3._id,
    farmerName: farmer3.name,
    grossProductValuePaise: 640000,
    farmerSharePct: 90,
    farmerPayoutPaise: 576000,
    platformCommissionPaise: 51200,
    operationsReservePaise: 12800,
    settlementStatus: 'settled',
    bankAccountLast4: '2019',
    upiId: 'lakshmifarm@icici',
    transactionReference: 'NEFT-UTR-20261018901',
    settledAt: new Date(),
    notes: 'Direct Bank Settlement completed via ICICI/NEFT.',
  });

  console.log('✅ AgriConnect Seed successfully initialized!');
  console.log('Development seed users created. Credentials are documented in the local development guide.');
}

// Allow direct CLI execution: npm run seed
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  import('../config/db.js').then(async ({ connectDB, disconnectDB }) => {
    await connectDB();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  });
}
