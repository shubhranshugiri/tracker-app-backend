import mongoose from 'mongoose';

const breadcrumbSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  altitude: { type: Number, default: 0 },
  battery: { type: Number, default: 100 },
  timestamp: { type: Number, default: Date.now },
  annotation: { type: String }
}, { _id: false });

const vehicleSchema = new mongoose.Schema({
  trackerId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  plateNumber: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    default: 'Heavy Commercial Vehicle'
  },
  status: {
    type: String,
    enum: ['moving', 'idling', 'stopped'],
    default: 'stopped'
  },
  driver: {
    type: String,
    default: 'Fleet Operator'
  },
  battery: {
    type: Number,
    default: 100
  },
  batteryStatus: {
    type: String,
    enum: ['charging', 'unplugged', 'normal', 'low'],
    default: 'normal'
  },
  speed: {
    type: Number,
    default: 0
  },
  heading: {
    type: Number,
    default: 0
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  cargo: {
    type: String,
    default: 'General Freight'
  },
  destination: {
    type: String,
    default: 'Logistics Center'
  },
  isRealDevice: {
    type: Boolean,
    default: false
  },
  source: {
    type: String,
    default: 'simulated'
  },
  lastUpdated: {
    type: Number,
    default: Date.now
  },
  history: [breadcrumbSchema]
}, {
  timestamps: true
});

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
