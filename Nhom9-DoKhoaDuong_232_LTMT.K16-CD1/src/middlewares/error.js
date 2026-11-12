const ApiError = require('../utils/ApiError');
const env = require('../config/env');

exports.notFound = (req, res, next) =>
  next(ApiError.notFound(`Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  // Request lỗi => dọn các ảnh đã kịp upload để không bị mồ côi
  const uploaded = req.files || (req.file ? [req.file] : []);
  if (uploaded.length && (err.statusCode || 500) >= 400) {
    require('./upload').removeFiles(uploaded.map(require('./upload').fileUrl));
  }

  let status = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    message = 'Dữ liệu không hợp lệ';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Giá trị không hợp lệ cho trường "${err.path}"`;
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Giá trị của "${field}" đã tồn tại`;
  } else if (err.name === 'JsonWebTokenError') {
    status = 401; message = 'Token không hợp lệ';
  } else if (err.name === 'TokenExpiredError') {
    status = 401; message = 'Token đã hết hạn';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh vượt quá dung lượng cho phép (5MB)'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Số lượng ảnh vượt quá giới hạn (tối đa 10)'
      : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'JSON không hợp lệ';
  }

  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    message: status >= 500 && env.isProd ? 'Lỗi máy chủ' : message,
    ...(details && { errors: details }),
    ...(!env.isProd && status >= 500 && { stack: err.stack }),
  });
};
