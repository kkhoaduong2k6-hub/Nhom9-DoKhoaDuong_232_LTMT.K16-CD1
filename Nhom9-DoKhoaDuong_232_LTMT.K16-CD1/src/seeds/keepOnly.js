// Chỉ giữ lại: mọi tài khoản admin + chutro@gmail.com (và chutro@example.com nếu là bản cũ chưa chuẩn hoá).
// Xóa tất cả tài khoản còn lại cùng dữ liệu gắn với họ.
//   node src/seeds/keepOnly.js --dry-run   # chỉ xem trước
//   node src/seeds/keepOnly.js             # thực hiện
// Sau đó chạy:  npm run migrate:users   (chuẩn hoá email/SĐT, dựng index duy nhất)
const mongoose = require('mongoose');
const env = require('../config/env');
const { removeFiles } = require('../middlewares/upload');

const KEEP_EMAILS = ['chutro@gmail.com', 'chutro@example.com'];
const DRY = process.argv.includes('--dry-run');

(async () => {
  await mongoose.connect(env.mongoUri);
  const db = mongoose.connection.db;
  console.log(`Database: ${mongoose.connection.host}/${mongoose.connection.name}${DRY ? '  [DRY-RUN: không ghi]' : ''}`);
  const col = (n) => db.collection(n);

  const keepFilter = { $or: [{ role: 'admin' }, { email: { $in: KEEP_EMAILS } }] };
  const kept = await col('users').find(keepFilter).toArray();
  if (!kept.some((u) => u.role === 'admin')) { console.error('❌ Không tìm thấy admin, dừng lại.'); process.exit(1); }
  const keepIds = kept.map((u) => u._id);
  const removed = await col('users').find({ _id: { $nin: keepIds } }).toArray();
  const rmIds = removed.map((u) => u._id);

  console.log('Giữ lại:'); kept.forEach((u) => console.log(`   ✔ ${u.email} [${u.role}]`));
  console.log(`Sẽ xóa ${removed.length} tài khoản:`); removed.forEach((u) => console.log(`   ✘ ${u.email} [${u.role}]`));

  // Dữ liệu gắn với tài khoản bị xóa
  const badRooms = await col('rooms').find({ landlord: { $in: rmIds } }).project({ images: 1 }).toArray();
  const badRoomIds = badRooms.map((r) => r._id);
  const q = {
    bookings: { $or: [{ student: { $in: rmIds } }, { landlord: { $in: rmIds } }, { room: { $in: badRoomIds } }] },
    contracts: { $or: [{ tenant: { $in: rmIds } }, { landlord: { $in: rmIds } }, { room: { $in: badRoomIds } }] },
    reviews: { $or: [{ student: { $in: rmIds } }, { room: { $in: badRoomIds } }] },
    reports: { $or: [{ reporter: { $in: rmIds } }, { room: { $in: badRoomIds } }] },
  };
  const counts = {};
  for (const [name, f] of Object.entries(q)) counts[name] = await col(name).countDocuments(f);
  console.log(`Sẽ xóa kèm: ${badRooms.length} phòng của các chủ trọ bị xóa, ${counts.bookings} booking, ${counts.contracts} hợp đồng, ${counts.reviews} đánh giá, ${counts.reports} báo cáo`);

  if (DRY) { console.log('\n(dry-run) Chưa thay đổi gì.'); await mongoose.disconnect(); return; }

  removeFiles(badRooms.flatMap((r) => r.images || []));
  const touchedRooms = (await col('contracts').find(q.contracts).project({ room: 1 }).toArray()).map((c) => c.room);
  const touchedReviewRooms = (await col('reviews').find(q.reviews).project({ room: 1 }).toArray()).map((r) => r.room);
  for (const name of Object.keys(q)) await col(name).deleteMany(q[name]);
  await col('rooms').deleteMany({ _id: { $in: badRoomIds } });
  await col('users').deleteMany({ _id: { $in: rmIds } });

  // Phòng của chủ trọ được giữ: nếu không còn hợp đồng hiệu lực thì trả về "còn trống"; tính lại điểm đánh giá
  const roomIds = [...new Set([...touchedRooms, ...touchedReviewRooms].map(String))].map((id) => new mongoose.Types.ObjectId(id));
  for (const id of roomIds) {
    if (!(await col('rooms').findOne({ _id: id }))) continue;
    if (!(await col('contracts').countDocuments({ room: id, status: 'active' }))) await col('rooms').updateOne({ _id: id }, { $set: { availability: 'available' } });
    const [agg] = await col('reviews').aggregate([{ $match: { room: id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]).toArray();
    await col('rooms').updateOne({ _id: id }, { $set: { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg ? agg.n : 0 } });
  }
  console.log(`\n✅ Xong. Còn lại ${await col('users').countDocuments()} tài khoản, ${await col('rooms').countDocuments()} phòng.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });