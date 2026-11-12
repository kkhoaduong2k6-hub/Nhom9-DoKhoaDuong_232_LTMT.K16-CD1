const Room = require('../models/Room');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');

// Factory CRUD cho District / Amenity
// usedBy: hàm trả về true nếu danh mục đang được dùng (không cho xóa)
module.exports = (Model, label, { usedBy, transform = (b) => b, sort = 'name' } = {}) => ({
  list: asyncHandler(async (req, res) => ok(res, await Model.find().sort(sort))),

  create: asyncHandler(async (req, res) => {
    const doc = await Model.create(transform(req.body));
    created(res, doc, `Đã thêm ${label}`);
  }),

  update: asyncHandler(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, transform(req.body), { new: true, runValidators: true });
    if (!doc) throw ApiError.notFound(`Không tìm thấy ${label}`);
    ok(res, doc, `Đã cập nhật ${label}`);
  }),

  remove: asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw ApiError.notFound(`Không tìm thấy ${label}`);
    if (usedBy && (await usedBy(doc._id))) throw ApiError.badRequest(`${label} đang được sử dụng, không thể xóa`);
    await doc.deleteOne();
    noContent(res); // 204 No Content
  }),
});

module.exports.usage = {
  district: (id) => Room.exists({ district: id }),
  amenity: (id) => Room.exists({ amenities: id }),
};