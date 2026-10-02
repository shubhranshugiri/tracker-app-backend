import mongoose from 'mongoose';

const supplyHubSchema = new mongoose.Schema({
  hubId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'Logistics Park'
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  radiusMeters: {
    type: Number,
    default: 1500
  },
  dockCount: {
    type: Number,
    default: 10
  },
  capacity: {
    type: String,
    default: '500+ Shipments/Day'
  }
});

export const SupplyHub = mongoose.model('SupplyHub', supplyHubSchema);
