// OpenAPI 3.0 - được sinh từ danh sách endpoint ngắn gọn bên dưới
const env = require('../config/env');

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'MongoDB ObjectId' };
const q = (name, type = 'string', description = '', extra = {}) => ({ name, in: 'query', schema: { type, ...extra }, description });
const pageQ = [q('page', 'integer', 'Trang (mặc định 1)'), q('limit', 'integer', 'Số bản ghi/trang (mặc định 10, tối đa 50)')];
const obj = (props, required = []) => ({ type: 'object', required, properties: props });
const S = { type: 'string' }; const N = { type: 'number' };

const bodyJson = (schema) => ({ required: true, content: { 'application/json': { schema } } });
const bodyForm = (schema) => ({ required: true, content: { 'multipart/form-data': { schema } } });

const roomProps = {
  title: S, description: S, price: N, area: N, address: S,
  district: { type: 'string', description: 'ID quận/huyện' },
  roomType: { type: 'string', enum: ['private', 'shared', 'mini_apartment', 'dormitory'] },
  amenities: { type: 'string', description: 'ID tiện nghi, ngăn cách bằng dấu phẩy' },
  electricityPrice: N, waterPrice: N, maxPeople: N,
};

// [method, path, tag, summary, {auth, params, query, body}]
const E = [
  // ---- Auth
  ['post', '/auth/register', 'Auth', 'Đăng ký (role: student | landlord) - không tự đăng nhập, cần gọi /auth/login', { body: bodyJson(obj({ name: S, email: { type: 'string', description: 'Bắt buộc đuôi @gmail.com, không trùng' }, password: { type: 'string', minLength: 6 }, phone: { type: 'string', description: 'Đúng 10 chữ số, không trùng' }, role: { type: 'string', enum: ['student', 'landlord'] } }, ['name', 'email', 'password', 'phone'])) }],
  ['post', '/auth/login', 'Auth', 'Đăng nhập, nhận access + refresh token', { body: bodyJson(obj({ email: S, password: S }, ['email', 'password'])) }],
  ['post', '/auth/refresh-token', 'Auth', 'Cấp lại access token (xoay vòng refresh token)', { body: bodyJson(obj({ refreshToken: S }, ['refreshToken'])) }],
  ['post', '/auth/logout', 'Auth', 'Đăng xuất (thu hồi refresh token hiện tại)', { auth: true, body: bodyJson(obj({ refreshToken: S })) }],
  ['post', '/auth/logout-all', 'Auth', 'Đăng xuất mọi thiết bị', { auth: true }],
  // ---- Users
  ['get', '/users/me', 'Users', 'Xem hồ sơ', { auth: true }],
  ['put', '/users/me', 'Users', 'Cập nhật hồ sơ', { auth: true, body: bodyJson(obj({ name: S, phone: S })) }],
  ['put', '/users/me/password', 'Users', 'Đổi mật khẩu', { auth: true, body: bodyJson(obj({ currentPassword: S, newPassword: S }, ['currentPassword', 'newPassword'])) }],
  // ---- Rooms
  ['get', '/rooms', 'Rooms', 'Tìm kiếm & lọc phòng (công khai)', { params: [...pageQ,
        q('roomType', 'string', 'private,shared,mini_apartment,dormitory'), q('amenities', 'string', 'ID tiện nghi (phải có tất cả)'), q('maxPeople', 'integer'),
    q('availability', 'string', 'available (mặc định) | rented | all')] }],
  ['get', '/rooms/{id}', 'Rooms', 'Chi tiết phòng (tăng lượt xem)', { params: [idParam] }],
  ['post', '/rooms', 'Rooms', 'Chủ trọ đăng phòng (multipart, tối đa 10 ảnh field "images")', { auth: true, body: bodyForm(obj({ ...roomProps, images: { type: 'array', items: { type: 'string', format: 'binary' } } }, ['title', 'price', 'area', 'address', 'district', 'roomType'])) }],
  ['put', '/rooms/{id}', 'Rooms', 'Sửa phòng (phòng đã duyệt sẽ về chờ duyệt lại)', { auth: true, params: [idParam], body: bodyJson(obj(roomProps)) }],
  ['delete', '/rooms/{id}', 'Rooms', 'Xóa phòng', { auth: true, params: [idParam] }],
  ['patch', '/rooms/{id}/toggle-hidden', 'Rooms', 'Ẩn/hiện phòng', { auth: true, params: [idParam] }],
  ['patch', '/rooms/{id}/availability', 'Rooms', 'Đánh dấu còn trống / đã cho thuê', { auth: true, params: [idParam], body: bodyJson(obj({ availability: { type: 'string', enum: ['available', 'rented'] } }, ['availability'])) }],
  ['post', '/rooms/{id}/images', 'Rooms', 'Thêm ảnh phòng', { auth: true, params: [idParam], body: bodyForm(obj({ images: { type: 'array', items: { type: 'string', format: 'binary' } } })) }],
  ['delete', '/rooms/{id}/images', 'Rooms', 'Xóa 1 ảnh phòng', { auth: true, params: [idParam], body: bodyJson(obj({ image: S }, ['image'])) }],
  ['get', '/rooms/mine/list', 'Landlord', 'Danh sách phòng của tôi', { auth: true, params: [...pageQ, q('approvalStatus')] }],
  ['get', '/rooms/mine/stats', 'Landlord', 'Thống kê của chủ trọ (lượt xem, yêu cầu chờ...)', { auth: true }],
  // ---- Bookings
  ['post', '/bookings', 'Bookings', 'Sinh viên đặt lịch xem phòng / gửi yêu cầu thuê', { auth: true, body: bodyJson(obj({ room: S, type: { type: 'string', enum: ['viewing', 'rental'] }, scheduledAt: { type: 'string', format: 'date-time', description: 'viewing: phải lớn hơn thời gian hiện tại' }, moveInDate: { type: 'string', format: 'date', description: 'rental: bắt buộc, phải sau ngày xem phòng ≥ 1 ngày' } }, ['room', 'type'])) }],
  ['get', '/bookings/mine', 'Bookings', 'Yêu cầu của tôi (sinh viên)', { auth: true, params: [...pageQ, q('status'), q('type')] }],
  ['get', '/bookings/received', 'Bookings', 'Yêu cầu nhận được (chủ trọ)', { auth: true, params: [...pageQ, q('status'), q('type')] }],
  ['patch', '/bookings/{id}/decision', 'Bookings', 'Chủ trọ duyệt / từ chối', { auth: true, params: [idParam], body: bodyJson(obj({ status: { type: 'string', enum: ['approved', 'rejected'] }, landlordNote: S }, ['status'])) }],
  ['patch', '/bookings/{id}/cancel', 'Bookings', 'Sinh viên hủy yêu cầu', { auth: true, params: [idParam] }],
  // ---- Categories
  ['get', '/categories/districts', 'Categories', 'Danh sách quận/huyện'],
  ['post', '/categories/districts', 'Categories', 'Thêm quận/huyện (admin)', { auth: true, body: bodyJson(obj({ name: S }, ['name'])) }],
  ['put', '/categories/districts/{id}', 'Categories', 'Sửa quận/huyện (admin)', { auth: true, params: [idParam], body: bodyJson(obj({ name: S }, ['name'])) }],
  ['delete', '/categories/districts/{id}', 'Categories', 'Xóa quận/huyện (admin)', { auth: true, params: [idParam] }],
  ['get', '/categories/amenities', 'Categories', 'Danh sách tiện nghi'],
  ['post', '/categories/amenities', 'Categories', 'Thêm tiện nghi (admin)', { auth: true, body: bodyJson(obj({ name: S, icon: S }, ['name'])) }],
  ['put', '/categories/amenities/{id}', 'Categories', 'Sửa tiện nghi (admin)', { auth: true, params: [idParam], body: bodyJson(obj({ name: S, icon: S }, ['name'])) }],
  ['delete', '/categories/amenities/{id}', 'Categories', 'Xóa tiện nghi (admin)', { auth: true, params: [idParam] }],
  // ---- Admin
  ['get', '/admin/stats', 'Admin', 'Thống kê tổng quan', { auth: true }],
  ['get', '/admin/users', 'Admin', 'Danh sách người dùng', { auth: true, params: [...pageQ, q('role'), q('isActive', 'boolean'), q('q')] }],
  ['patch', '/admin/users/{id}/lock', 'Admin', 'Khóa tài khoản', { auth: true, params: [idParam] }],
  ['patch', '/admin/users/{id}/unlock', 'Admin', 'Mở khóa tài khoản', { auth: true, params: [idParam] }],
  ['delete', '/admin/users/{id}', 'Admin', 'Xóa tài khoản', { auth: true, params: [idParam] }],
  ['get', '/admin/rooms', 'Admin', 'Danh sách bài đăng (lọc approvalStatus=pending để duyệt)', { auth: true, params: [...pageQ, q('approvalStatus'), q('q')] }],
    ['patch', '/admin/rooms/{id}/approve', 'Admin', 'Duyệt bài đăng (chỉ bài đang chờ duyệt)', { auth: true, params: [idParam] }],
  ['patch', '/admin/rooms/{id}/reject', 'Admin', 'Từ chối bài đăng (chỉ bài đang chờ duyệt, không đăng lại được)', { auth: true, params: [idParam], body: bodyJson(obj({ reason: S }, ['reason'])) }],
  ['patch', '/admin/rooms/{id}/remove', 'Admin', 'Gỡ bài đăng (chỉ bài đã duyệt)', { auth: true, params: [idParam], body: bodyJson(obj({ reason: S })) }],
  ['get', '/health', 'System', 'Kiểm tra server'],
];

const paths = {};
E.forEach(([method, path, tag, summary, opt = {}]) => {
  paths[path] = paths[path] || {};
  paths[path][method] = {
    tags: [tag], summary,
    ...(opt.auth && { security: [{ bearerAuth: [] }] }),
    ...(opt.params && { parameters: opt.params }),
    ...(opt.body && { requestBody: opt.body }),
    responses: {
      200: { description: 'Thành công' }, 201: { description: 'Tạo thành công' },
      ...(method === 'delete' && { 204: { description: 'Xóa thành công, không có nội dung' } }),
      400: { description: 'Dữ liệu không hợp lệ' }, 401: { description: 'Chưa xác thực' },
      403: { description: 'Không đủ quyền' }, 404: { description: 'Không tìm thấy' }, 409: { description: 'Xung đột dữ liệu' },
    },
  };
  // path có {id} nhưng chưa khai báo param (vd /rooms/{id}/...) => bổ sung
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API Tìm kiếm & Cho thuê phòng trọ sinh viên Hà Nội',
    version: '1.0.0',
    description: 'RESTful API (Node.js, Express, MongoDB). Vai trò: guest, student, landlord, admin.\n\nBấm **Authorize** và dán access token (không cần gõ "Bearer").',
  },
  servers: [{ url: `${env.baseUrl}/api/v1` }],
  tags: ['Auth', 'Users', 'Rooms', 'Landlord', 'Bookings', 'Categories', 'Admin', 'System'].map((name) => ({ name })),
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths,
};