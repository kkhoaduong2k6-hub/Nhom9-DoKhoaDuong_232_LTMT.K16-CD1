const mongoose = require('mongoose');

const District = mongoose.model('District', new mongoose.Schema(
  { name: { type: String, required: [true, 'Tên quận/huyện là bắt buộc'], unique: true, trim: true } },
  { timestamps: true }
));

const Amenity = mongoose.model('Amenity', new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Tên tiện nghi là bắt buộc'], unique: true, trim: true },
    icon: { type: String },
  },
  { timestamps: true }
));

module.exports = { District, Amenity };