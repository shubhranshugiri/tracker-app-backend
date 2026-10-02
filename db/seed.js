import { User } from '../models/User.js';
import { Vehicle } from '../models/Vehicle.js';
import { TollPlaza } from '../models/TollPlaza.js';
import { SupplyHub } from '../models/SupplyHub.js';

export async function seedDatabase() {
  try {
    // 1. Auto-create authorized User if not exists
    const adminEmail = process.env.AUTHORIZED_EMAIL || 'girishubhranshu3@gmail.com';
    const adminPassword = process.env.AUTHORIZED_PASSWORD || 'User@123';
    const existingUser = await User.findOne({ email: adminEmail });
    if (!existingUser) {
      await User.create({
        name: 'Shubhranshu Giri',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        isActive: true
      });
      console.log(`✅ [Database Auto-Init] Authorized user created: ${adminEmail}`);
    }

    // 2. Auto-create Toll Plazas if empty
    const tollCount = await TollPlaza.countDocuments();
    if (tollCount === 0) {
      await TollPlaza.insertMany([
        {
          tollId: 'toll-khalapur',
          name: 'Khalapur Toll Plaza',
          highway: 'Mumbai - Pune Expressway',
          lat: 18.8475,
          lon: 73.2842,
          rates: { car: 320, lcv: 495, truck: 680, multiAxle: 1070 },
          fastagActive: true,
          avgWaitTimeMin: 2
        },
        {
          tollId: 'toll-talegaon',
          name: 'Talegaon Toll Plaza',
          highway: 'Mumbai - Pune Expressway (Pune End)',
          lat: 18.7314,
          lon: 73.6872,
          rates: { car: 215, lcv: 340, truck: 460, multiAxle: 710 },
          fastagActive: true,
          avgWaitTimeMin: 1.5
        },
        {
          tollId: 'toll-vashi',
          name: 'Vashi Creek Toll Plaza',
          highway: 'Sion - Panvel Expressway',
          lat: 19.0628,
          lon: 72.9845,
          rates: { car: 45, lcv: 70, truck: 105, multiAxle: 160 },
          fastagActive: true,
          avgWaitTimeMin: 3
        },
        {
          tollId: 'toll-padgha',
          name: 'Padgha Toll Plaza',
          highway: 'NH-160 (Mumbai - Nashik Corridor)',
          lat: 19.3496,
          lon: 73.1895,
          rates: { car: 110, lcv: 175, truck: 245, multiAxle: 390 },
          fastagActive: true,
          avgWaitTimeMin: 2
        }
      ]);
      console.log('✅ [Database Auto-Init] Toll plazas seeded automatically.');
    }

    // 3. Auto-create Supply Hubs if empty
    const hubCount = await SupplyHub.countDocuments();
    if (hubCount === 0) {
      await SupplyHub.insertMany([
        {
          hubId: 'hub-jnpt',
          name: 'JNPT Port Container Terminal',
          city: 'Navi Mumbai',
          type: 'Maritime Container Hub',
          lat: 18.9498,
          lon: 72.9510,
          radiusMeters: 2000,
          dockCount: 36,
          capacity: '1,200 Containers/Day'
        },
        {
          hubId: 'hub-bhiwandi',
          name: 'Bhiwandi Mega Logistics Park',
          city: 'Thane',
          type: 'E-Commerce Central Warehouse',
          lat: 19.2967,
          lon: 73.0631,
          radiusMeters: 2500,
          dockCount: 52,
          capacity: '8,000 Parcels/Hr'
        },
        {
          hubId: 'hub-chakan',
          name: 'Chakan MIDC Industrial Auto Hub',
          city: 'Pune',
          type: 'Automotive Component Supply Park',
          lat: 18.7612,
          lon: 73.8344,
          radiusMeters: 3000,
          dockCount: 44,
          capacity: '400 Heavy Assemblies/Day'
        }
      ]);
      console.log('✅ [Database Auto-Init] Supply hubs seeded automatically.');
    }

    // 4. Auto-create initial Fleet Vehicles if empty
    const vehicleCount = await Vehicle.countDocuments();
    if (vehicleCount === 0) {
      await Vehicle.insertMany([
        {
          trackerId: 'T1',
          name: 'Scania R500 Long Haul',
          plateNumber: 'MH-12-RP-4421',
          type: 'Heavy Multi-Axle Truck',
          status: 'moving',
          driver: 'Rajesh Kumar',
          battery: 89,
          batteryStatus: 'charging',
          speed: 68,
          heading: 105,
          lat: 18.9498,
          lon: 72.9510,
          cargo: 'Electronic Auto Parts (18 Tons)',
          destination: 'Chakan MIDC Auto Supply Hub',
          history: [
            { lat: 18.9498, lon: 72.9510, speed: 68, heading: 105, timestamp: Date.now() - 60000 },
            { lat: 18.9550, lon: 72.9650, speed: 70, heading: 105, timestamp: Date.now() }
          ]
        },
        {
          trackerId: 'T2',
          name: 'Volvo FM 420 Container',
          plateNumber: 'MH-04-AX-8910',
          type: 'Container Trailer',
          status: 'moving',
          driver: 'Anil Deshmukh',
          battery: 76,
          batteryStatus: 'normal',
          speed: 52,
          heading: 45,
          lat: 19.1600,
          lon: 72.9500,
          cargo: 'Pharma Cold Storage (12 Tons)',
          destination: 'Bhiwandi Mega Logistics Park',
          history: []
        },
        {
          trackerId: 'T3',
          name: 'Tata Signa 4825.TK',
          plateNumber: 'GJ-15-BB-3109',
          type: 'Heavy Tipper',
          status: 'idling',
          driver: 'Sunil Verma',
          battery: 42,
          batteryStatus: 'normal',
          speed: 0,
          heading: 270,
          lat: 19.3496,
          lon: 73.1895,
          cargo: 'Industrial Raw Polymers',
          destination: 'Vapi Industrial Hub',
          history: []
        }
      ]);
      console.log('✅ [Database Auto-Init] Initial fleet vehicles seeded automatically.');
    }
  } catch (err) {
    console.error('❌ [Database Seed Error]', err.message);
  }
}
