const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
    bookingId: { type: String, required: true },
    roomId: { type: String, required: true },
    contactName: { type: String, required: true },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, required: true },
    contactChannel: { type: String, required: true },
    totalCustomer: { type: Number, required: true },
    identifyCardNumber: { type: Array, default: [] },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    type: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'PENDING' },
    supplierTransaction: { type: String, default: null },
    supplierResponses: { type: Array, default: [] },
    paymentAt: { type: Date, default: null },
    ip: { type: String, default: null },
    note: { type: String, default: null },
  },
  {
    timestamps: true
  }
);

// index schema

bookingSchema.index({ bookingId: 1 }, { unique: true });
bookingSchema.index({ from: 1 }, { unique: false });
bookingSchema.index({ to: 1 }, { unique: false });
// bookingSchema.index({ roomId: 1 }, { unique: false });
// bookingSchema.index({
//   from: 1,
//   to: 1,
//   status: 1,
//   roomId: 1
// });

module.exports = mongoose.model('Booking', bookingSchema);
