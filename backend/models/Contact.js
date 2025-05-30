const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  replied: { type: Boolean, default: false },
  replyText: { type: String, default: '' }
});

// 👇 Use this to prevent OverwriteModelError
module.exports = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
