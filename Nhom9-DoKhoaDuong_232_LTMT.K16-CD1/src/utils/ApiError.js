class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
  static badRequest(msg = 'Dữ liệu không hợp lệ', details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Chưa đăng nhập hoặc token không hợp lệ') { return new ApiError(401, msg); }
  static forbidden(msg = 'Bạn không có quyền thực hiện thao tác này') { return new ApiError(403, msg); }
  static notFound(msg = 'Không tìm thấy dữ liệu') { return new ApiError(404, msg); }
  static conflict(msg = 'Dữ liệu đã tồn tại') { return new ApiError(409, msg); }
}
module.exports = ApiError;
