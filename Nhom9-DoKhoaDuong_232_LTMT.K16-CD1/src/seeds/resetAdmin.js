// Đặt lại tài khoản admin:  node src/seeds/resetAdmin.js
// Có thể truyền email/mật khẩu riêng:  node src/seeds/resetAdmin.js email@gmail.com MatKhauMoi123
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');

(async () => {
  const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email) { console.error('Thiếu email: truyền tham số hoặc đặt ADMIN_EMAIL trong .env'); process.exit(1); }
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'Admin@123456';

  await mongoose.connect(env.mongoUri);
  console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  let user = await User.findOne({ email }).select('+password +refreshTokens');
  if (user) {
    user.password = password;       // pre-save sẽ tự mã hóa bcrypt
    user.role = 'admin';
    user.isActive = true;
    user.refreshTokens = [];
    await user.save();
    console.log('✅ Đã đặt lại mật khẩu cho admin hiện có');
  } else {
    user = await User.create({ name: 'Quản trị viên', email, password, role: 'admin' });
    console.log('✅ Đã tạo mới tài khoản admin');
  }

  const ok = await (await User.findOne({ email }).select('+password')).comparePassword(password);
  console.log(`Kiểm tra đăng nhập: ${ok ? 'ĐÚNG' : 'SAI'}`);
  console.log(`   Email    : ${email}\n   Mật khẩu : ${password}`);

  const all = await User.find().select('email role isActive');
  console.log('\nCác tài khoản trong database:');
  all.forEach((u) => console.log(`   - ${u.email} [${u.role}] ${u.isActive ? '' : '(ĐÃ KHÓA)'}`));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });