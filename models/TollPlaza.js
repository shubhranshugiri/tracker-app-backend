import mongoose from 'mongoose';

const tollPlazaSchema = new mongoose.Schema({
  tollId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  highway: {
    type: String,
    required: true
  },
  lat: {
    type: Number,
    required: true
  },
  lon: {
    type: Number,
    required: true
  },
  rates: {
    car: { type: Number, default: 100 },
    lcv: { type: Number, default: 160 },
    truck: { type: Number, default: 320 },
    multiAxle: { type: Number, default: 540 }
  },
  fastagActive: {
    type: Boolean,
    default: true
  },
  avgWaitTimeMin: {
    type: Number,
    default: 2
  }
});

export const TollPlaza = mongoose.model('TollPlaza', tollPlazaSchema);
