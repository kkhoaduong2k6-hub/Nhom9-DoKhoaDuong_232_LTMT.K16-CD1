const rateLimit = require('express-rate-limit');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { success: false, message },
  });

exports.globalLimiter = make(15 * 60 * 1000, 300, 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau');
exports.authLimiter = make(15 * 60 * 1000, 20, 'Quá nhiều lần thử đăng nhập/đăng ký, vui lòng thử lại sau 15 phút');
