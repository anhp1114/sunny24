const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const accountSchema = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true }
});

accountSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model('Account', accountSchema);
