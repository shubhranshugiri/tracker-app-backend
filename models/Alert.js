import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    required: true,
    index: true
  },
  vehicleName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'danger'],
    default: 'info'
  },
  message: {
    type: String,
    required: true
  },
  time: {
    type: Number,
    default: Date.now,
    index: true
  },
  resolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export const Alert = mongoose.model('Alert', alertSchema);
