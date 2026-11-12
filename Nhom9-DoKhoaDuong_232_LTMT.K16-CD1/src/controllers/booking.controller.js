const Booking = require('../models/Booking');
const Room = require('../models/Room');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, paginated } = require('../utils/response');
const { getPagination } = require('../utils/pagination');
const { vnDay, fmt } = require('../utils/dates');

const POP = [
  { path: 'room', select: 'title price address images availability' },
  { path: 'student', select: 'name phone email' },
  { path: 'viewing', select: 'scheduledAt status' },
  { path: 'landlord', select: 'name phone email' },
];

exports.create = asyncHandler(async (req, res) => {
  const { room: roomId, type, scheduledAt, moveInDate } = req.body;
  const room = await Room.findById(roomId);
  if (!room || room.approvalStatus !== 'approved' || room.isHidden) throw ApiError.notFound('Phòng không tồn tại hoặc chưa được hiển thị');
  if (room.availability !== 'available') throw ApiError.badRequest('Phòng này đã được cho thuê');

  const dup = await Booking.exists({ student: req.user._id, room: roomId, type, status: { $in: ['pending', 'approved'] } });
  if (dup) throw ApiError.conflict('Bạn đã có yêu cầu tương tự đang chờ xử lý hoặc đã được duyệt cho phòng này');

  // Yêu cầu thuê phải dựa trên một lịch xem phòng, và ngày dọn vào phải sau ngày xem ít nhất 1 ngày
  let viewing;
  if (type === 'rental') {
    viewing = await Booking.findOne({
      student: req.user._id, room: roomId, type: 'viewing', status: { $in: ['pending', 'approved'] },
    }).sort('-scheduledAt');
    if (!viewing) throw ApiError.badRequest('Bạn cần đặt lịch xem phòng trước khi gửi yêu cầu thuê');
    if (vnDay(moveInDate) < vnDay(viewing.scheduledAt) + 1) {
      throw ApiError.badRequest(`Ngày dự kiến dọn vào phải sau ngày xem phòng (${fmt(viewing.scheduledAt)}) ít nhất 1 ngày`);
    }
  }

  const booking = await Booking.create({
    student: req.user._id, room: roomId, landlord: room.landlord, type, scheduledAt, moveInDate,
    viewing: viewing ? viewing._id : undefined,
  });
  created(res, booking, type === 'viewing' ? 'Đã gửi lịch xem phòng' : 'Đã gửi yêu cầu thuê');
});

exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { student: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const [items, total] = await Promise.all([
    Booking.find(filter).sort('-createdAt').skip(skip).limit(limit).populate(POP),
    Booking.countDocuments(filter),
  ]);
  paginated(res, items, total, page, limit);
});

exports.forLandlord = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { landlord: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const [items, total] = await Promise.all([
    Booking.find(filter).sort('-createdAt').skip(skip).limit(limit).populate(POP),
    Booking.countDocuments(filter),
  ]);
  paginated(res, items, total, page, limit);
});

exports.decide = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Không tìm thấy yêu cầu');
  if (String(booking.landlord) !== String(req.user._id)) throw ApiError.forbidden();
  if (booking.status !== 'pending') throw ApiError.badRequest(`Yêu cầu đã ở trạng thái "${booking.status}"`);
  booking.status = req.body.status;
  booking.landlordNote = req.body.landlordNote;
  await booking.save();
  // Chủ trọ duyệt yêu cầu thuê => phòng tự động bị ẩn khỏi danh sách
  if (booking.type === 'rental' && booking.status === 'approved') {
    await Room.updateOne({ _id: booking.room }, { isHidden: true });
  }
  ok(res, booking, req.body.status === 'approved' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu');
});

exports.cancel = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Không tìm thấy yêu cầu');
  if (String(booking.student) !== String(req.user._id)) throw ApiError.forbidden();
  // Chỉ được hủy khi chủ trọ chưa duyệt; đã duyệt (đã lên lịch) thì không thể hủy
  if (booking.status !== 'pending') throw ApiError.badRequest('Yêu cầu đã được xử lý, không thể hủy');
  booking.status = 'cancelled';
  await booking.save();
  ok(res, booking, 'Đã hủy yêu cầu');
});