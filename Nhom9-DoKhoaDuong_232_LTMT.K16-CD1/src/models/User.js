const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Họ tên là bắt buộc'], trim: true, maxlength: 80 },
    email: {
      type: String, required: [true, 'Email là bắt buộc'], unique: true, lowercase: true, trim: true,
      match: [/^[a-z0-9._%+-]+@gmail\.com$/, 'Email phải có đuôi @gmail.com'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: {
      type: String, trim: true, unique: true, sparse: true,
      match: [/^0\d{9}$/, 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0'],
    },
    role: { type: String, enum: ['student', 'landlord', 'admin'], default: 'student' },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [String], default: [], select: false }, // lưu hash sha256
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function compare(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password; delete ret.refreshTokens;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);