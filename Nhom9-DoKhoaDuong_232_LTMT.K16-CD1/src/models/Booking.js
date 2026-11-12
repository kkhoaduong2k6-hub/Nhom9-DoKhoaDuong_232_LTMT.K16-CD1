const mongoose = require('mongoose');

const { Schema } = mongoose;

// Dùng chung cho "đặt lịch xem phòng" (viewing) và "yêu cầu thuê" (rental)
const bookingSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    landlord: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['viewing', 'rental'], required: true },
    scheduledAt: { type: Date },  // bắt buộc với viewing
    moveInDate: { type: Date },   // dự kiến dọn vào với rental (phải sau ngày xem phòng ≥ 1 ngày)
    viewing: { type: Schema.Types.ObjectId, ref: 'Booking' }, // lịch xem phòng làm căn cứ cho rental
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    landlordNote: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
