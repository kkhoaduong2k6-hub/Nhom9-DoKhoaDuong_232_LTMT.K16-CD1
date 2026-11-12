const mongoose = require('mongoose');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { removeFiles, fileUrl } = require('../middlewares/upload');

const POPULATE = [
  { path: 'district', select: 'name' },
  { path: 'amenities', select: 'name icon' },
  { path: 'landlord', select: 'name phone email' },
];
const oid = (v) => new mongoose.Types.ObjectId(v);
const toArr = (v) => (Array.isArray(v) ? v : [v]);
const isOwnerOrAdmin = (room, user) => user && (user.role === 'admin' || String(room.landlord._id || room.landlord) === String(user._id));

async function findOwned(req) {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Không tìm thấy phòng');
  if (req.user.role !== 'admin' && String(room.landlord) !== String(req.user._id)) {
    throw ApiError.forbidden('Bạn không phải chủ phòng này');
  }
  return room;
}

/* ---------- Tìm kiếm & lọc công khai ---------- */
exports.search = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = getPagination(q, 12);

  const match = { approvalStatus: 'approved', isHidden: false };
  if (q.availability !== 'all') match.availability = q.availability;
  if (q.district) match.district = { $in: toArr(q.district).map(oid) };
  if (q.roomType) match.roomType = { $in: toArr(q.roomType) };
  if (q.amenities) match.amenities = { $all: toArr(q.amenities).map(oid) };
  if (q.maxPeople) match.maxPeople = { $gte: q.maxPeople };

  const [items, total] = await Promise.all([
    Room.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Room.countDocuments(match),
  ]);
  paginated(res, items, total, page, limit);
});

/* ---------- Chi tiết phòng ---------- */
exports.getById = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id).populate(POPULATE);
  if (!room) throw ApiError.notFound('Không tìm thấy phòng');

  const privileged = isOwnerOrAdmin(room, req.user);
  const visible = room.approvalStatus === 'approved' && !room.isHidden;
  if (!visible && !privileged) throw ApiError.notFound('Không tìm thấy phòng');

  if (!privileged) await Room.updateOne({ _id: room._id }, { $inc: { views: 1 } });

  const data = room.toObject();
  if (req.user && req.user.role === 'student') {
    const viewing = await Booking.findOne({
      student: req.user._id, room: room._id, type: 'viewing', status: { $in: ['pending', 'approved'] },
    }).sort('-scheduledAt').select('scheduledAt');
    data.myViewing = viewing ? { _id: viewing._id, scheduledAt: viewing.scheduledAt } : null; // căn cứ cho ngày dọn vào
  }
  ok(res, data);
});

/* ---------- CRUD của chủ trọ ---------- */
exports.create = asyncHandler(async (req, res) => {
  const images = (req.files || []).map(fileUrl);
  try {
    const room = await Room.create({ ...req.body, images, landlord: req.user._id, approvalStatus: 'pending' });
    created(res, room, 'Đăng phòng thành công, vui lòng chờ quản trị viên duyệt');
  } catch (e) { removeFiles(images); throw e; }
});

exports.update = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  // Bài bị từ chối / bị gỡ thì không được sửa để đăng lại
  if (req.user.role === 'landlord' && ['rejected', 'removed'].includes(room.approvalStatus)) {
    throw ApiError.forbidden('Bài đăng đã bị từ chối/gỡ nên không thể chỉnh sửa hoặc đăng lại');
  }
  Object.assign(room, req.body);
  // Chủ trọ sửa nội dung phòng đã duyệt => phải duyệt lại
  if (req.user.role === 'landlord' && room.approvalStatus === 'approved') {
    room.approvalStatus = 'pending';
    room.rejectReason = undefined;
  }
  await room.save();
  ok(res, room, 'Cập nhật phòng thành công');
});

exports.remove = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  await Promise.all([
    room.deleteOne(),
    Booking.deleteMany({ room: room._id, status: 'pending' }),
  ]);
  removeFiles(room.images);
  noContent(res); // 204 No Content
});

exports.toggleHidden = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  room.isHidden = !room.isHidden;
  await room.save();
  ok(res, { isHidden: room.isHidden }, room.isHidden ? 'Đã ẩn phòng' : 'Đã hiện phòng');
});

exports.setAvailability = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  room.availability = req.body.availability;
  await room.save();
  ok(res, { availability: room.availability }, 'Đã cập nhật trạng thái phòng');
});

exports.addImages = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  const added = (req.files || []).map(fileUrl);
  if (!added.length) throw ApiError.badRequest('Vui lòng chọn ít nhất 1 ảnh (field "images")');
  if (room.images.length + added.length > 15) {
    removeFiles(added);
    throw ApiError.badRequest('Mỗi phòng tối đa 15 ảnh');
  }
  room.images.push(...added);
  await room.save();
  ok(res, room, 'Đã thêm ảnh');
});

exports.removeImage = asyncHandler(async (req, res) => {
  const room = await findOwned(req);
  if (!room.images.includes(req.body.image)) throw ApiError.notFound('Ảnh không thuộc phòng này');
  room.images = room.images.filter((i) => i !== req.body.image);
  await room.save();
  removeFiles([req.body.image]);
  ok(res, room, 'Đã xóa ảnh');
});

/* ---------- Phòng của tôi + thống kê ---------- */
exports.myRooms = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { landlord: req.user._id };
  if (req.query.approvalStatus) filter.approvalStatus = req.query.approvalStatus;
  const [items, total] = await Promise.all([
    Room.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('district', 'name'),
    Room.countDocuments(filter),
  ]);
  paginated(res, items, total, page, limit);
});

exports.landlordStats = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const [roomAgg, byStatus, pendingBookings, topViewed] = await Promise.all([
    Room.aggregate([{ $match: { landlord: id } }, { $group: { _id: null, rooms: { $sum: 1 }, totalViews: { $sum: '$views' } } }]),
    Room.aggregate([{ $match: { landlord: id } }, { $group: { _id: '$approvalStatus', n: { $sum: 1 } } }]),
    Booking.countDocuments({ landlord: id, status: 'pending' }),
    Room.find({ landlord: id }).sort('-views').limit(5).select('title views availability'),
  ]);
  ok(res, {
    totalRooms: roomAgg[0]?.rooms || 0,
    totalViews: roomAgg[0]?.totalViews || 0,
    roomsByApprovalStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
    pendingBookings,
    topViewedRooms: topViewed,
  });
});