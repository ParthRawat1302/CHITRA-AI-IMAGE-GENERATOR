const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    prompt: String,
    imageUrl: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Image || mongoose.model("Image", imageSchema);

