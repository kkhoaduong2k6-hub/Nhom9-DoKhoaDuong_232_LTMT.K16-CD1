// Chạy: npm run seed   (thêm --reset để xóa sạch dữ liệu cũ)
const mongoose = require('mongoose');
const env = require('../config/env');
const User = require('../models/User');
const Room = require('../models/Room');
const { District, Amenity } = require('../models/categories');
require('../models/Booking');

const DISTRICTS = ['Ba Đình', 'Hoàn Kiếm', 'Hai Bà Trưng', 'Đống Đa', 'Tây Hồ', 'Cầu Giấy', 'Thanh Xuân', 'Hoàng Mai',
  'Long Biên', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Hà Đông', 'Gia Lâm', 'Thanh Trì'];
const AMENITIES = ['Điều hòa', 'Nóng lạnh', 'Wifi', 'Chỗ để xe', 'Gác lửng', 'Tủ lạnh', 'Máy giặt', 'Giường tủ', 'Bếp riêng', 'Vệ sinh khép kín', 'Camera an ninh', 'Giờ giấc tự do'];
(async () => {
  await mongoose.connect(env.mongoUri);
  if (process.argv.includes('--reset')) {
    await mongoose.connection.dropDatabase();
    console.log('🗑️  Đã xóa dữ liệu cũ');
  }

  for (const name of DISTRICTS) await District.updateOne({ name }, { name }, { upsert: true });
  for (const name of AMENITIES) await Amenity.updateOne({ name }, { name }, { upsert: true });

  const upsertUser = async (data) => (await User.findOne({ email: data.email })) || User.create(data);
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!adminEmail) throw new Error('Thiếu ADMIN_EMAIL trong .env');
  const admin = await upsertUser({ name: 'Quản trị viên', email: adminEmail, password: process.env.ADMIN_PASSWORD || 'Admin@123456', role: 'admin' });

  // Xóa tài khoản quản trị cũ admin@gmail.com (chỉ xóa khi đã có admin khác thay thế)
  if (adminEmail !== 'admin@gmail.com') {
    const del = await User.deleteOne({ email: 'admin@gmail.com', role: 'admin' });
    if (del.deletedCount) console.log('🗑️  Đã xóa tài khoản admin@gmail.com');
  }
  const landlord = await upsertUser({ name: 'Nguyễn Văn Chủ', email: 'chutro@gmail.com', password: '123456', phone: '0912345678', role: 'landlord' });
  await upsertUser({ name: 'Trần Thị Sinh Viên', email: 'sinhvien@gmail.com', password: '123456', phone: '0987654321', role: 'student' });

  if ((await Room.countDocuments({ landlord: landlord._id })) === 0) {
    const d = Object.fromEntries((await District.find()).map((x) => [x.name, x._id]));
    const a = Object.fromEntries((await Amenity.find()).map((x) => [x.name, x._id]));
    const samples = [
      ['Phòng trọ gần ĐH Bách Khoa, full nội thất', 'private', 'Hai Bà Trưng', 'Ngõ 120 Trần Đại Nghĩa', 3200000, 25, ['Điều hòa', 'Nóng lạnh', 'Wifi', 'Chỗ để xe']],
      ['Chung cư mini khép kín gần Kinh tế Quốc dân', 'mini_apartment', 'Hai Bà Trưng', 'Ngõ 25 Giải Phóng', 4500000, 30, ['Điều hòa', 'Nóng lạnh', 'Wifi', 'Máy giặt', 'Vệ sinh khép kín']],
      ['Phòng ở ghép nữ gần ĐH Xây dựng, giá rẻ', 'shared', 'Hai Bà Trưng', 'Ngõ 55 Giải Phóng', 1200000, 18, ['Wifi', 'Chỗ để xe', 'Giường tủ']],
      ['Phòng gác lửng gần ĐH Thương mại, Cầu Giấy', 'private', 'Cầu Giấy', 'Ngõ 79 Hồ Tùng Mậu', 2800000, 22, ['Gác lửng', 'Nóng lạnh', 'Wifi', 'Giờ giấc tự do']],
      ['Phòng trọ Nguyễn Trãi gần ĐH KHTN', 'private', 'Thanh Xuân', 'Ngõ 100 Nguyễn Trãi', 3000000, 24, ['Điều hòa', 'Nóng lạnh', 'Wifi', 'Camera an ninh']],
      ['Ký túc xá tư nhân gần ĐH Ngoại thương', 'dormitory', 'Đống Đa', 'Ngõ 91 Chùa Láng', 900000, 12, ['Wifi', 'Giường tủ', 'Chỗ để xe']],
      ['Chung cư mini gần ĐH Sư phạm HN, ban công thoáng', 'mini_apartment', 'Cầu Giấy', 'Ngõ 136 Xuân Thủy', 5000000, 35, ['Điều hòa', 'Nóng lạnh', 'Wifi', 'Bếp riêng', 'Tủ lạnh']],
      ['Phòng trọ sinh viên Hà Đông giá mềm', 'private', 'Hà Đông', 'Phố Quang Trung, Hà Đông', 2000000, 20, ['Wifi', 'Chỗ để xe', 'Nóng lạnh']],
    ];
    await Room.insertMany(samples.map(([title, roomType, dist, address, price, area, ams]) => ({
      landlord: landlord._id, title, roomType, district: d[dist], address, price, area,
      description: `${title}. Phòng sạch sẽ, an ninh tốt, gần trường và chợ, chủ nhà thân thiện. Liên hệ để xem phòng.`,
      amenities: ams.map((n) => a[n]), electricityPrice: 3500, waterPrice: 100000, maxPeople: roomType === 'private' ? 2 : 4,
      approvalStatus: 'approved', images: [],
    })));
    console.log(`🏠 Đã tạo ${samples.length} phòng mẫu (đã duyệt)`);
  }

  console.log('\n✅ Seed hoàn tất. Tài khoản thử nghiệm:');
  console.log(`   Admin    : ${admin.email} / ${process.env.ADMIN_PASSWORD || 'Admin@123456'}`);
  console.log('   Chủ trọ  : chutro@gmail.com / 123456');
  console.log('   Sinh viên: sinhvien@gmail.com / 123456\n');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });