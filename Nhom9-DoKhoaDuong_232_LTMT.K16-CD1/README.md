# 🏠 API Tìm kiếm & Cho thuê phòng trọ sinh viên Hà Nội

RESTful Web Service bằng **Node.js + Express + MongoDB (Mongoose)**, mô hình MVC. Mọi endpoint có tiền tố **`/api/v1`**.

## Chạy nhanh
```bash
npm install
cp .env.example .env        # rồi sửa MONGODB_URI và 2 JWT secret
npm run seed                # nạp quận, tiện nghi, tài khoản & phòng mẫu
npm run dev                 # http://localhost:5000
```
- Swagger UI: `http://localhost:5000/api-docs`
- Postman: import `docs/postman_collection.json` (chạy Login/Register sẽ tự lưu `accessToken`). Tạo lại bằng `node scripts/genPostman.js`. Mỗi API có 1 request **[ĐÚNG]** và 1 request **[SAI]**, kèm script kiểm thử.
- Tài khoản seed: admin theo `ADMIN_EMAIL`/`ADMIN_PASSWORD` trong `.env`, `chutro@gmail.com / 123456`, `sinhvien@gmail.com / 123456`.

## Giao diện web
Chạy `npm run dev` rồi mở **http://localhost:5000** — giao diện HTML/CSS/JS thuần nằm trong `public/`, gọi API bằng `fetch` (không cần build).
```
public/index.html           khung trang
public/css/style.css
public/js/core.js           tiện ích, gọi API (tự refresh token), session
public/js/pages-public.js   tìm kiếm & lọc, chi tiết phòng, đăng nhập/đăng ký
public/js/pages-student.js  lịch & yêu cầu thuê, hợp đồng, hồ sơ
public/js/pages-manage.js   khu vực chủ trọ (/#/landlord/...) và admin (/#/admin/...)
public/js/main.js           thanh điều hướng, router theo hash, xử lý sự kiện
```
Mỗi trang đăng ký bằng `App.route('/duong-dan', handler, [vai trò được vào])`; form dùng `data-form="ten"` ↔ `App.forms.ten`, nút dùng `data-action="ten"` ↔ `App.actions.ten`.

## Kiểm thử tự động
```bash
npm test      # Jest + Supertest + MongoDB in-memory (lần đầu sẽ tải binary MongoDB, cần internet)
```
`tests/api.test.js` chạy trọn luồng: đăng ký/đăng nhập/refresh → đăng phòng + upload ảnh → admin duyệt → tìm kiếm, lọc → đặt lịch/yêu cầu thuê → hợp đồng → đánh giá → báo cáo → khóa tài khoản → danh mục (xóa trả 204) → thống kê.

## Cấu trúc
```
src/
  config/        env, kết nối DB
  models/        User, Room, Booking, Contract, Review, Report, categories (District, Amenity)
  controllers/   xử lý nghiệp vụ
  routes/        khai báo endpoint + gắn middleware
  middlewares/   auth (JWT + phân quyền), validate (Joi), upload (multer), rateLimit, error (xử lý lỗi tập trung)
  validators/    schema Joi
  docs/          OpenAPI (Swagger)
  seeds/         dữ liệu mẫu
  utils/         ApiError, asyncHandler, token, pagination, email
```

## Mã trạng thái HTTP
| Mã | Dùng khi |
|---|---|
| 200 | Thành công (GET, PUT, PATCH, một số POST như đăng nhập) |
| 201 | Tạo mới thành công (đăng ký, đăng phòng, đặt lịch, hợp đồng, đánh giá...) |
| 204 | Xóa thành công (`DELETE /rooms/:id`, `/reviews/:id`, `/categories/*/:id`) - không có body |
| 400 | Dữ liệu không hợp lệ / vi phạm quy tắc nghiệp vụ |
| 401 | Chưa đăng nhập, token sai/hết hạn |
| 403 | Không đủ quyền |
| 404 | Không tìm thấy tài nguyên/đường dẫn |
| 409 | Trùng dữ liệu (email, SĐT, đánh giá, báo cáo...) |
| 500 | Lỗi máy chủ |

## Phân quyền
| Vai trò | Quyền chính |
|---|---|
| Khách | Xem/tìm phòng, xem đánh giá, danh mục |
| `student` | Yêu thích, đặt lịch xem / gửi yêu cầu thuê, đánh giá (phải có hợp đồng thuê), báo cáo |
| `landlord` | Đăng/sửa/xóa/ẩn phòng, upload ảnh, duyệt yêu cầu, quản lý hợp đồng, thống kê |
| `admin` | Khóa/mở khóa user, duyệt/từ chối/gỡ bài, quản lý danh mục, xử lý báo cáo, thống kê |

## Luồng nghiệp vụ
1. Chủ trọ đăng phòng → `pending` → Admin `approve` → hiển thị công khai (sửa phòng đã duyệt sẽ phải duyệt lại).
2. Sinh viên `POST /bookings` (type `viewing` hoặc `rental`) → chủ trọ `PATCH /bookings/:id/decision`.
3. Chủ trọ `POST /contracts` (từ booking `rental` đã duyệt) → phòng tự chuyển `rented`; `PATCH /contracts/:id/end` → phòng `available`.
4. Sinh viên có hợp đồng mới được `POST /rooms/:roomId/reviews`.

## Tìm kiếm
`GET /api/v1/rooms?district=id1,id2&roomType=private,shared&amenities=id1,id2&page=1&limit=12` (mới nhất trước)

## Xác thực
- `register` chỉ tạo tài khoản (không tự đăng nhập); `login` trả `accessToken` (15 phút) + `refreshToken` (7 ngày). Refresh token lưu **dạng hash**, xoay vòng mỗi lần `POST /auth/refresh-token`, thu hồi khi `logout`, đổi/đặt lại mật khẩu, hoặc bị khóa.
- Gửi header `Authorization: Bearer <accessToken>`.
- Quy tắc tài khoản: email bắt buộc đuôi `@gmail.com`; số điện thoại đúng 10 chữ số; mật khẩu tối thiểu 6 ký tự; **email và số điện thoại không được trùng** giữa các tài khoản.
- Không còn chức năng quên mật khẩu, ảnh đại diện, yêu thích.

## Quy tắc ngày (đặt lịch / thuê / hợp đồng)
- Lịch xem phòng (`scheduledAt`) phải lớn hơn thời điểm hiện tại.
- Yêu cầu thuê cần đã có lịch xem phòng của chính sinh viên đó; `moveInDate` (bắt buộc) phải sau ngày xem phòng **ít nhất 1 ngày** (so theo ngày, giờ Việt Nam).
- Hợp đồng tạo từ yêu cầu thuê đã duyệt; `startDate` phải nằm giữa ngày xem phòng và `moveInDate` (gồm cả hai đầu).

## Chuẩn hoá dữ liệu cũ
```bash
node src/seeds/normalizeData.js --dry-run   # xem trước
npm run migrate:users                       # sửa email/SĐT tài khoản cũ, dựng index duy nhất
npm run migrate:purge                       # HOẶC xóa sạch, chỉ giữ admin (phòng, booking, hợp đồng... bị xóa)
```

## Bảo mật
bcrypt, JWT, helmet, CORS theo `CLIENT_URL`, rate-limit (toàn cục + chặt hơn cho auth), Joi `stripUnknown`, giới hạn ảnh (JPG/PNG/WEBP, 5MB, ≤10 ảnh), không lộ stack khi production.

## Deploy (Render + MongoDB Atlas)
1. Atlas: tạo cluster miễn phí → Database Access (user) → Network Access (`0.0.0.0/0`) → lấy connection string.
2. Đẩy code lên GitHub. Render: **New → Blueprint** (đọc `render.yaml`) hoặc **New Web Service** (Build `npm install`, Start `npm start`).
3. Đặt biến: `MONGODB_URI`, `BASE_URL` (URL Render), `CLIENT_URL` (domain frontend).
4. Seed dữ liệu 1 lần: chạy `npm run seed` ở máy local với `MONGODB_URI` trỏ vào Atlas.

> ⚠️ Ổ đĩa Render/Railway bản miễn phí là **tạm thời** — ảnh lưu trong `uploads/` sẽ mất khi redeploy.
> Giải pháp: tạo tài khoản Cloudinary (miễn phí) và đặt biến `CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>`.
> Khi có biến này, ảnh tự động được đẩy lên Cloudinary (URL đầy đủ lưu vào DB, xóa phòng/ảnh sẽ xóa luôn trên Cloudinary); không có thì dùng ổ đĩa cục bộ.

## Tiến độ
Đã làm: toàn bộ chức năng trong yêu cầu (auth, phòng, tìm kiếm, booking, hợp đồng, đánh giá, báo cáo, admin, thống kê, Swagger, Postman, cấu hình deploy), bộ test tự động, upload Cloudinary (tùy chọn).
Chưa làm: xác thực email, thông báo realtime.