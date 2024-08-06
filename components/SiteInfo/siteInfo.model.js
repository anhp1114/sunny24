const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SiteInfoSchema = new Schema(
  {
    phoneNumber: { type: String, default: null },
    facebook: { type: String, default: null },
    zalo: { type: String, default: null },
    tiktok: { type: String, default: null },
    instagram: { type: String, default: null },
    youtube: { type: String, default: null },
    images: { type: Array, default: [] },
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SiteInfo', SiteInfoSchema);
