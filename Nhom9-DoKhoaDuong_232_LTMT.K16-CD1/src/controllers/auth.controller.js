const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const {
  signAccessToken, signRefreshToken, verifyRefreshToken, sha256,
} = require('../utils/token');

const MAX_SESSIONS = 5;

// Cấp cặp token mới và lưu hash refresh token (hỗ trợ nhiều thiết bị)
async function issueTokens(user, oldHash) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const fresh = await User.findById(user._id).select('+refreshTokens');
  let list = fresh.refreshTokens.filter((h) => h !== oldHash);
  list.push(sha256(refreshToken));
  if (list.length > MAX_SESSIONS) list = list.slice(-MAX_SESSIONS);
  fresh.refreshTokens = list;
  await fresh.save();
  return { accessToken, refreshToken };
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('Email đã được đăng ký');
  if (await User.exists({ phone })) throw ApiError.conflict('Số điện thoại đã được đăng ký');
  const user = await User.create({ name, email, password, phone, role });
  // Không cấp token: người dùng phải quay lại trang đăng nhập để đăng nhập
  created(res, { user }, 'Đăng ký thành công, vui lòng đăng nhập');
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');
  }
  if (!user.isActive) throw ApiError.forbidden('Tài khoản đã bị khóa, vui lòng liên hệ quản trị viên');
  const tokens = await issueTokens(user);
  ok(res, { user, ...tokens }, 'Đăng nhập thành công');
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const decoded = verifyRefreshToken(refreshToken);
  const hash = sha256(refreshToken);
  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(hash)) {
    throw ApiError.unauthorized('Refresh token không hợp lệ hoặc đã bị thu hồi');
  }
  if (!user.isActive) throw ApiError.forbidden('Tài khoản đã bị khóa');
  const tokens = await issueTokens(user, hash); // xoay vòng refresh token
  ok(res, tokens);
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await User.updateOne({ _id: req.user._id }, { $pull: { refreshTokens: sha256(refreshToken) } });
  }
  ok(res, null, 'Đăng xuất thành công');
});

exports.logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $set: { refreshTokens: [] } });
  ok(res, null, 'Đã đăng xuất khỏi tất cả thiết bị');
});
