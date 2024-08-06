const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  description: { type: String, default: null },
  services: { type: String, default: null },
  address: { type: String, default: null },
  addressLink: { type: String, default: null },
  googleDriveLink: { type: String, default: null },
  selfCheckInLink: { type: String, default: null },
  images: { type: Array, default: [] },
  bookingTimeSlots: [
    {
      _id: false,
      name: { type: String, default: null },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
      hours: { type: Number, default: null },
    }
  ],
  priceList: {
    threeHours: { type: Number, required: true },
    // fiveHours: { type: Number, required: true },
    overNight: { type: Number, required: true },
    day: { type: Number, required: true },
    week: { type: Number, required: true },
    compoDiscount: { type: Number, required: true }
  },
  wifi: { type: String, default: null },
  projector: { type: String, default: null },
  rule: { type: String, default: null },
  customPrice: {
    date: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    priceList: {
      type: Object,
      default: {}
    }
  },
  branchId: { type: Number }
}, {
  timestamps: true
});

// index schema

roomSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);