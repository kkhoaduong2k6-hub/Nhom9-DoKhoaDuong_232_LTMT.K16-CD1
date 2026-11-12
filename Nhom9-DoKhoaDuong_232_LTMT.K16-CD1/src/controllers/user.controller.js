const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');

exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  ok(res, user);
});

exports.updateMe = asyncHandler(async (req, res) => {
  if (req.body.phone && await User.exists({ phone: req.body.phone, _id: { $ne: req.user._id } })) {
    throw ApiError.conflict('Số điện thoại đã được sử dụng');
  }
  const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
  ok(res, user, 'Cập nhật hồ sơ thành công');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +refreshTokens');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Mật khẩu hiện tại không đúng');
  }
  user.password = req.body.newPassword;
  user.refreshTokens = [];
  await user.save();
  ok(res, null, 'Đổi mật khẩu thành công, vui lòng đăng nhập lại');
});