const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { removeFiles } = require('../middlewares/upload');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---- Người dùng ---- */
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  paginated(res, items, total, page, limit);
});

async function setActive(req, res, active) {
  const user = await User.findById(req.params.id).select('+refreshTokens');
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');
  if (user.role === 'admin') throw ApiError.badRequest('Không thể khóa tài khoản admin');
  user.isActive = active;
  if (!active) user.refreshTokens = []; // thu hồi phiên đăng nhập
  await user.save();
  ok(res, user, active ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
}
exports.lockUser = asyncHandler((req, res) => setActive(req, res, false));
exports.unlockUser = asyncHandler((req, res) => setActive(req, res, true));

// Xóa tài khoản (kèm dữ liệu liên quan: phòng + ảnh của chủ trọ, các yêu cầu/lịch xem liên quan)
exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');
  if (user.role === 'admin') throw ApiError.badRequest('Không thể xóa tài khoản admin');

  if (user.role === 'landlord') {
    const rooms = await Room.find({ landlord: user._id }).select('images');
    const roomIds = rooms.map((r) => r._id);
    await Booking.deleteMany({ $or: [{ landlord: user._id }, { room: { $in: roomIds } }] });
    await Room.deleteMany({ landlord: user._id });
    rooms.forEach((r) => removeFiles(r.images));
  } else {
    await Booking.deleteMany({ student: user._id });
  }
  await user.deleteOne();
  ok(res, null, 'Đã xóa tài khoản');
});

/* ---- Duyệt bài đăng ---- */
exports.listRooms = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
  if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');
  const [items, total] = await Promise.all([
    Room.find(filter).sort('-createdAt').skip(skip).limit(limit)
      .populate('landlord', 'name email phone').populate('district', 'name'),
    Room.countDocuments(filter),
  ]);
  paginated(res, items, total, page, limit);
});

// Luồng duyệt: pending -> approved | rejected ; approved -> removed. rejected/removed là trạng thái cuối.
async function setApproval(req, res, status, reason, allowedFrom) {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Không tìm thấy phòng');
  if (!allowedFrom.includes(room.approvalStatus)) {
    throw ApiError.badRequest(`Không thể chuyển bài từ trạng thái "${room.approvalStatus}" sang "${status}"`);
  }
  room.approvalStatus = status;
  room.rejectReason = reason;
  await room.save();
  return room;
}
exports.approveRoom = asyncHandler(async (req, res) =>
  ok(res, await setApproval(req, res, 'approved', undefined, ['pending']), 'Đã duyệt bài đăng'));
exports.rejectRoom = asyncHandler(async (req, res) =>
  ok(res, await setApproval(req, res, 'rejected', req.body.reason, ['pending']), 'Đã từ chối bài đăng'));
exports.removeRoom = asyncHandler(async (req, res) =>
  ok(res, await setApproval(req, res, 'removed', req.body.reason || 'Bị gỡ bởi quản trị viên', ['approved']), 'Đã gỡ bài đăng'));

/* ---- Thống kê ---- */
exports.stats = asyncHandler(async (req, res) => {
  const [users, rooms, bookings, roomsByDistrict, newUsers] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Room.aggregate([{ $group: { _id: '$approvalStatus', n: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: { type: '$type', status: '$status' }, n: { $sum: 1 } } }]),
    Room.aggregate([
      { $match: { approvalStatus: 'approved' } },
      { $group: { _id: '$district', n: { $sum: 1 }, avgPrice: { $avg: '$price' } } },
      { $lookup: { from: 'districts', localField: '_id', foreignField: '_id', as: 'd' } },
      { $project: { _id: 0, district: { $arrayElemAt: ['$d.name', 0] }, rooms: '$n', avgPrice: { $round: ['$avgPrice', 0] } } },
      { $sort: { rooms: -1 } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const toMap = (arr) => Object.fromEntries(arr.map((x) => [x._id, x.n]));
  const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
  const userMap = toMap(users); const roomMap = toMap(rooms);
  const rentalRequests = bookings.filter((b) => b._id.type === 'rental').reduce((a, b) => a + b.n, 0);
  const viewingRequests = bookings.filter((b) => b._id.type === 'viewing').reduce((a, b) => a + b.n, 0);

  ok(res, {
    users: { total: sum(userMap), byRole: userMap },
    rooms: { total: sum(roomMap), byApprovalStatus: roomMap },
    rentalRequests, viewingRequests,
    bookingBreakdown: bookings.map((b) => ({ type: b._id.type, status: b._id.status, count: b.n })),
    roomsByDistrict,
    newUsersLast30Days: newUsers.map((x) => ({ date: x._id, count: x.n })),
  });
});