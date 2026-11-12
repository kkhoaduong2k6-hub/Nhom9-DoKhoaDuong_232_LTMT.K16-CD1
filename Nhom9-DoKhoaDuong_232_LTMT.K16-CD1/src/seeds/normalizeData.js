// Chuẩn hoá dữ liệu CŨ cho khớp quy tắc mới. Chạy MỘT lần:
//   node src/seeds/normalizeData.js            -> sửa tài khoản cũ (email @gmail.com, SĐT 10 số, không trùng)
//   node src/seeds/normalizeData.js --purge    -> XÓA toàn bộ dữ liệu, chỉ giữ lại tài khoản admin
//   thêm --dry-run để chỉ xem trước, không ghi vào database
//
// Không đụng tới mật khẩu (đã mã hóa bcrypt, vốn >= 6 ký tự do validate từ trước).
const mongoose = require('mongoose');
const env = require('../config/env');
const { removeFiles } = require('../middlewares/upload');

const args = process.argv.slice(2);
const PURGE = args.includes('--purge');
const DRY = args.includes('--dry-run');

const GMAIL = /^[a-z0-9._%+-]+@gmail\.com$/;

// abc@yahoo.com -> abc@gmail.com ; ký tự lạ bị loại ; trùng thì thêm số 2, 3, ...
function toGmail(email, taken) {
  let local = String(email || '').toLowerCase().split('@')[0].replace(/[^a-z0-9._%+-]/g, '');
  if (!local) local = 'user';
  let candidate = `${local}@gmail.com`;
  for (let i = 2; taken.has(candidate); i += 1) candidate = `${local}${i}@gmail.com`;
  return candidate;
}

// +84912345678 / 0912 345 678 -> 0912345678 ; không ra đúng 10 số thì trả null
function toPhone(phone) {
  if (!phone) return null;
  let d = String(phone).replace(/[^\d+]/g, '');
  if (d.startsWith('+84')) d = `0${d.slice(3)}`;
  else if (d.startsWith('84') && d.length === 11) d = `0${d.slice(2)}`;
  d = d.replace(/\D/g, '');
  return /^0\d{9}$/.test(d) ? d : null;
}

(async () => {
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db;
  console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}${DRY ? '  [DRY-RUN: không ghi]' : ''}`);
  const users = db.collection('users');
  const run = async (fn) => { if (!DRY) await fn(); };

  const dropIfExists = async (name) => {
    if ((await db.listCollections({ name }).toArray()).length) await run(() => db.collection(name).drop());
  };

  // ---- Dọn các thứ đã bỏ khỏi hệ thống (luôn thực hiện) ----
  await dropIfExists('favorites');
  await run(() => users.updateMany({}, { $unset: { avatar: '', resetPasswordToken: '', resetPasswordExpire: '' } }));
  await run(() => db.collection('bookings').updateMany({}, { $unset: { message: '' } }));
  console.log('✔ Đã bỏ dữ liệu yêu thích, ảnh đại diện, token quên mật khẩu, lời nhắn');

  if (PURGE) {
    const admins = await users.find({ role: 'admin' }).toArray();
    if (!admins.length) { console.error('❌ Không có tài khoản admin nào, dừng để tránh mất hết dữ liệu.'); process.exit(1); }
    const rooms = await db.collection('rooms').find({}, { projection: { images: 1 } }).toArray();
    await run(async () => {
      removeFiles(rooms.flatMap((r) => r.images || []));
      await Promise.all(['rooms', 'bookings', 'contracts', 'reviews', 'reports'].map((c) => db.collection(c).deleteMany({})));
      await users.deleteMany({ role: { $ne: 'admin' } });
    });
    console.log(`🗑️  Đã xóa ${rooms.length} phòng cùng booking/hợp đồng/đánh giá/báo cáo và mọi tài khoản không phải admin`);
    console.log('   (danh mục quận, tiện nghi, trường đại học được giữ nguyên)');
  }

  // ---- Chuẩn hoá email / SĐT của tài khoản còn lại ----
  const all = await users.find({}).sort({ role: 1, createdAt: 1 }).toArray(); // admin lên trước để giữ email gốc
  const takenEmail = new Set(); const takenPhone = new Set();
  const report = [];
  for (const u of all) {
    const set = {}; const unset = {};
    let email = String(u.email || '').toLowerCase().trim();
    if (!GMAIL.test(email) || takenEmail.has(email)) email = toGmail(email, takenEmail);
    takenEmail.add(email);
    if (email !== u.email) set.email = email;

    const phone = toPhone(u.phone);
    if (phone && !takenPhone.has(phone)) { takenPhone.add(phone); if (phone !== u.phone) set.phone = phone; }
    else if (u.phone !== undefined && u.phone !== null) {
      unset.phone = ''; // sai định dạng hoặc trùng: không thể tự bịa số mới -> để trống, người dùng tự cập nhật
      report.push(`   ⚠ ${email}: SĐT "${u.phone}" ${phone ? 'bị trùng' : 'không đủ 10 số'} -> đã xóa, cần nhập lại`);
    } else if (u.phone === null) unset.phone = '';

    const change = {};
    if (Object.keys(set).length) change.$set = set;
    if (Object.keys(unset).length) change.$unset = unset;
    if (change.$set || change.$unset) {
      if (set.email) report.push(`   ✎ ${u.email} -> ${set.email}`);
      await run(() => users.updateOne({ _id: u._id }, change));
    }
  }
  report.forEach((l) => console.log(l));
  console.log(`✔ Đã kiểm tra ${all.length} tài khoản`);

  // Dựng lại index duy nhất cho email & SĐT
  await run(async () => {
    await users.dropIndexes().catch(() => {});
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ phone: 1 }, { unique: true, sparse: true });
  });
  console.log('✔ Đã tạo index duy nhất cho email và số điện thoại');

  console.log('\nTài khoản hiện có:');
  (await users.find({}).project({ email: 1, phone: 1, role: 1 }).toArray())
    .forEach((u) => console.log(`   - ${u.email} [${u.role}] ${u.phone || '(chưa có SĐT)'}`));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
