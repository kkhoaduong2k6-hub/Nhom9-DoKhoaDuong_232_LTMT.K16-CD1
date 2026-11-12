const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

const extract = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

// Bắt buộc đăng nhập
exports.protect = asyncHandler(async (req, res, next) => {
  const token = extract(req);
  if (!token) throw ApiError.unauthorized();
  const decoded = verifyAccessToken(token); // lỗi JWT được errorHandler xử lý
  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized('Người dùng không còn tồn tại');
  if (!user.isActive) throw ApiError.forbidden('Tài khoản đã bị khóa');
  req.user = user;
  next();
});

// Đăng nhập tùy chọn (khách vẫn xem được)
exports.optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extract(req);
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) req.user = user;
    } catch (_) { /* bỏ qua, coi như khách */ }
  }
  next();
});

// Phân quyền theo role
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};
