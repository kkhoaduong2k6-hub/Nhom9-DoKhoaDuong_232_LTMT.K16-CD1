const mongoose = require('mongoose');

const { Schema } = mongoose;

const roomSchema = new Schema(
  {
    landlord: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Tiêu đề là bắt buộc'], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000 },
    price: { type: Number, required: [true, 'Giá thuê là bắt buộc'], min: 0, index: true },
    area: { type: Number, required: [true, 'Diện tích là bắt buộc'], min: 1, index: true },
    address: { type: String, required: [true, 'Địa chỉ là bắt buộc'], trim: true },
    district: { type: Schema.Types.ObjectId, ref: 'District', required: true, index: true },
    roomType: {
      type: String, enum: ['private', 'shared', 'mini_apartment', 'dormitory'],
      required: true, index: true,
    }, // phòng riêng, ở ghép, chung cư mini, ký túc xá
    amenities: [{ type: Schema.Types.ObjectId, ref: 'Amenity' }],
    electricityPrice: { type: Number, min: 0, default: 0 }, // đ/kWh
    waterPrice: { type: Number, min: 0, default: 0 },       // đ/m3 hoặc đ/người
    maxPeople: { type: Number, min: 1, default: 1 },
    images: [{ type: String }],
    // Tọa độ không còn nhập từ form; phòng cũ vẫn giữ để tìm theo khoảng cách
    location: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
    // Kiểm duyệt & trạng thái
    approvalStatus: {
      type: String, enum: ['pending', 'approved', 'rejected', 'removed'], default: 'pending', index: true,
    },
    rejectReason: { type: String },
    isHidden: { type: Boolean, default: false },
    availability: { type: String, enum: ['available', 'rented'], default: 'available', index: true },
    // Thống kê
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

roomSchema.index({ location: '2dsphere' });
roomSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Room', roomSchema);