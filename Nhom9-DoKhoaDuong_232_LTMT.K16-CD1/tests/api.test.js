const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../src/app');
const User = require('../src/models/User');
const Room = require('../src/models/Room');
const { District, Amenity } = require('../src/models/categories');
const { removeFiles } = require('../src/middlewares/upload');

// PNG 1x1 hợp lệ
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const PHONES = { landlord: '091234567', student: '098765432' };
let mongod;
const S = {}; // state dùng chung giữa các test
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

async function register(role, i) {
  const res = await request(app).post('/api/v1/auth/register')
    .send({ name: `User ${role}`, email: `${role}${i || ''}@gmail.com`, phone: PHONES[role] + String(i || 0), password: '123456', role });
  return res;
}
const roomForm = (token, over = {}) => {
  const f = { title: 'Phòng trọ gần Bách Khoa full nội thất', price: 3000000, area: 25, address: 'Ngõ 1 Trần Đại Nghĩa',
    district: String(S.district._id), roomType: 'private', maxPeople: 2, amenities: String(S.amenity._id), ...over };
  let r = request(app).post('/api/v1/rooms').set(bearer(token));
  Object.entries(f).forEach(([k, v]) => { r = r.field(k, String(v)); });
  return r;
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // dựng index 2dsphere
  S.district = await District.create({ name: 'Hai Bà Trưng' });
  S.amenity = await Amenity.create({ name: 'Wifi' });
  await User.create({ name: 'Admin', email: 'admin@gmail.com', password: '123456', role: 'admin' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Xác thực', () => {
  test('đăng ký thành công, KHÔNG trả token (phải đăng nhập lại)', async () => {
    const [l, s] = [await register('landlord'), await register('student')];
    expect(l.status).toBe(201);
    expect(l.body.data.accessToken).toBeUndefined();
    expect(l.body.data.user.password).toBeUndefined();
    const [ll, sl] = await Promise.all(['landlord', 'student'].map((r) => request(app).post('/api/v1/auth/login').send({ email: `${r}@gmail.com`, password: '123456' })));
    expect(ll.status).toBe(200);
    S.landlord = ll.body.data; S.student = sl.body.data;
  });

  test('đăng ký trùng email => 409, trùng số điện thoại => 409', async () => {
    expect((await register('student')).status).toBe(409);
    const dupPhone = await request(app).post('/api/v1/auth/register')
      .send({ name: 'Trùng SĐT', email: 'khac@gmail.com', phone: PHONES.student + '0', password: '123456' });
    expect(dupPhone.status).toBe(409);
  });

  test('email phải @gmail.com, SĐT đủ 10 số, mật khẩu >= 6 ký tự', async () => {
    const base = { name: 'Nguyen Van A', email: 'a@gmail.com', phone: '0900000001', password: '123456' };
    const post = (o) => request(app).post('/api/v1/auth/register').send({ ...base, ...o });
    expect((await post({ email: 'a@yahoo.com' })).status).toBe(400);
    expect((await post({ phone: '090000000' })).status).toBe(400);
    expect((await post({ phone: '09000000012' })).status).toBe(400);
    expect((await post({ phone: undefined })).status).toBe(400);
    expect((await post({ password: '12345' })).status).toBe(400);
    expect((await post({})).status).toBe(201);
  });

  test('không còn API quên mật khẩu', async () => {
    expect((await request(app).post('/api/v1/auth/forgot-password').send({ email: 'student@gmail.com' })).status).toBe(404);
  });

  test('không cho tự đăng ký admin (role bị từ chối)', async () => {
    const res = await request(app).post('/api/v1/auth/register')
      .send({ name: 'Hack', email: 'hack@gmail.com', phone: '0900000002', password: '123456', role: 'admin' });
    expect(res.status).toBe(400);
  });

  test('validation lỗi => 400 kèm errors', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'A', email: 'sai', password: '1' });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('đăng nhập sai mật khẩu => 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'student@gmail.com', password: 'saisai' });
    expect(res.status).toBe(401);
  });

  test('đăng nhập admin', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@gmail.com', password: '123456' });
    expect(res.status).toBe(200);
    S.admin = res.body.data;
  });

  test('/users/me cần token', async () => {
    expect((await request(app).get('/api/v1/users/me')).status).toBe(401);
    const res = await request(app).get('/api/v1/users/me').set(bearer(S.student.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('student@gmail.com');
  });

  test('refresh token xoay vòng, dùng lại token cũ => 401', async () => {
    const old = S.student.refreshToken;
    const r1 = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: old });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(old);
    S.student = { ...S.student, ...r1.body.data };
    const r2 = await request(app).post('/api/v1/auth/refresh-token').send({ refreshToken: old });
    expect(r2.status).toBe(401);
  });

  test('cập nhật hồ sơ: SĐT trùng => 409, sai định dạng => 400', async () => {
    const t = S.student.accessToken;
    expect((await request(app).put('/api/v1/users/me').set(bearer(t)).send({ phone: PHONES.landlord + '0' })).status).toBe(409);
    expect((await request(app).put('/api/v1/users/me').set(bearer(t)).send({ phone: '123' })).status).toBe(400);
    expect((await request(app).put('/api/v1/users/me').set(bearer(t)).send({ name: 'Sinh Viên Mới' })).status).toBe(200);
  });

  test('đổi mật khẩu', async () => {
    const bad = await request(app).put('/api/v1/users/me/password').set(bearer(S.student.accessToken))
      .send({ currentPassword: 'sai', newPassword: 'abcdef' });
    expect(bad.status).toBe(400);
  });
});

describe('Phòng trọ', () => {
  test('sinh viên không được đăng phòng => 403', async () => {
    expect((await roomForm(S.student.accessToken)).status).toBe(403);
  });

  test('chủ trọ đăng phòng kèm ảnh => pending', async () => {
    const res = await roomForm(S.landlord.accessToken).attach('images', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.approvalStatus).toBe('pending');
    expect(res.body.data.images).toHaveLength(1);
    expect(res.body.data.location).toBeUndefined(); // không còn nhập vĩ độ/kinh độ
    S.room = res.body.data;
  });

  test('phòng chưa duyệt: khách không thấy (list & chi tiết)', async () => {
    const list = await request(app).get('/api/v1/rooms');
    expect(list.body.pagination.total).toBe(0);
    expect((await request(app).get(`/api/v1/rooms/${S.room._id}`)).status).toBe(404);
    // chủ phòng vẫn xem được
    expect((await request(app).get(`/api/v1/rooms/${S.room._id}`).set(bearer(S.landlord.accessToken))).status).toBe(200);
  });

  test('chỉ admin duyệt được', async () => {
    expect((await request(app).patch(`/api/v1/admin/rooms/${S.room._id}/approve`).set(bearer(S.landlord.accessToken))).status).toBe(403);
    const ok = await request(app).patch(`/api/v1/admin/rooms/${S.room._id}/approve`).set(bearer(S.admin.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body.data.approvalStatus).toBe('approved');
  });

  test('tìm kiếm, lọc, sắp xếp, phân trang', async () => {
    // thêm phòng xa & rẻ hơn để kiểm tra lọc/sắp xếp
    S.far = await Room.create({
      landlord: S.landlord.user._id, title: 'Phòng xa trung tâm giá rẻ Hà Đông', price: 1500000, area: 15, address: 'Hà Đông',
      district: S.district._id, roomType: 'shared', approvalStatus: 'approved', maxPeople: 4,
      location: { type: 'Point', coordinates: [105.769, 20.961] },
    });
    const all = await request(app).get('/api/v1/rooms');
    expect(all.body.pagination.total).toBe(2);

    const shared = await request(app).get('/api/v1/rooms?roomType=shared');
    expect(shared.body.data).toHaveLength(1);
    expect(shared.body.data[0].roomType).toBe('shared');

    // các bộ lọc đã bỏ (giá, diện tích, từ khóa, sắp xếp) bị bỏ qua, không còn lọc
    expect((await request(app).get('/api/v1/rooms?maxPrice=2000000')).body.data).toHaveLength(2);
    expect((await request(app).get('/api/v1/rooms').query({ q: 'Bách Khoa' })).body.data).toHaveLength(2);
    // mặc định mới nhất trước
    expect((await request(app).get('/api/v1/rooms')).body.data[0].price).toBe(1500000);

    const am = await request(app).get(`/api/v1/rooms?amenities=${S.amenity._id}`);
    expect(am.body.data).toHaveLength(1);

    const page = await request(app).get('/api/v1/rooms?limit=1&page=2');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination.totalPages).toBe(2);

    expect((await request(app).get('/api/v1/rooms?roomType=abc')).status).toBe(400);
  });

  test('chi tiết phòng tăng lượt xem', async () => {
    await request(app).get(`/api/v1/rooms/${S.room._id}`);
    const doc = await Room.findById(S.room._id);
    expect(doc.views).toBeGreaterThanOrEqual(1);
  });

  test('chủ khác không sửa được phòng', async () => {
    await register('landlord', 2);
    const otherLogin = await request(app).post('/api/v1/auth/login').send({ email: 'landlord2@gmail.com', password: '123456' });
    const res = await request(app).put(`/api/v1/rooms/${S.far._id}`).set(bearer(otherLogin.body.data.accessToken)).send({ price: 1 });
    expect(res.status).toBe(403);
  });

  test('sửa phòng đã duyệt => quay về pending; ẩn/hiện; trạng thái thuê', async () => {
    const up = await request(app).put(`/api/v1/rooms/${S.far._id}`).set(bearer(S.landlord.accessToken)).send({ price: 1600000 });
    expect(up.status).toBe(200);
    expect(up.body.data.approvalStatus).toBe('pending');
    await Room.updateOne({ _id: S.far._id }, { approvalStatus: 'approved' }); // khôi phục cho các test sau

    const hide = await request(app).patch(`/api/v1/rooms/${S.far._id}/toggle-hidden`).set(bearer(S.landlord.accessToken));
    expect(hide.body.data.isHidden).toBe(true);
    expect((await request(app).get('/api/v1/rooms')).body.pagination.total).toBe(1);
    await request(app).patch(`/api/v1/rooms/${S.far._id}/toggle-hidden`).set(bearer(S.landlord.accessToken));

    const av = await request(app).patch(`/api/v1/rooms/${S.far._id}/availability`).set(bearer(S.landlord.accessToken)).send({ availability: 'rented' });
    expect(av.body.data.availability).toBe('rented');
    expect((await request(app).get('/api/v1/rooms')).body.pagination.total).toBe(1); // mặc định chỉ hiện phòng còn trống
    expect((await request(app).get('/api/v1/rooms?availability=all')).body.pagination.total).toBe(2);
  });

  test('thêm & xóa ảnh', async () => {
    const add = await request(app).post(`/api/v1/rooms/${S.room._id}/images`).set(bearer(S.landlord.accessToken))
      .attach('images', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(add.status).toBe(200);
    expect(add.body.data.images).toHaveLength(2);
    const del = await request(app).delete(`/api/v1/rooms/${S.room._id}/images`).set(bearer(S.landlord.accessToken)).send({ image: add.body.data.images[1] });
    expect(del.body.data.images).toHaveLength(1);
  });

  test('từ chối file không phải ảnh => 400', async () => {
    const res = await roomForm(S.landlord.accessToken).attach('images', Buffer.from('abc'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });
});

describe('Sinh viên: đặt lịch & yêu cầu thuê', () => {
  test('đặt lịch xem phòng: cần scheduledAt, không trùng', async () => {
    const t = S.student.accessToken;
    expect((await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'viewing' })).status).toBe(400);
    // lịch xem phải lớn hơn thời gian hiện tại
    const past = await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'viewing', scheduledAt: future(-1) });
    expect(past.status).toBe(400);
    expect(past.body.errors[0].message).toMatch(/lớn hơn thời gian hiện tại/);
    // chưa có lịch xem => không gửi được yêu cầu thuê
    const early = await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'rental', moveInDate: future(10) });
    expect(early.status).toBe(400);
    const ok = await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'viewing', scheduledAt: future(2) });
    expect(ok.status).toBe(201);
    S.viewing = ok.body.data;
    expect((await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'viewing', scheduledAt: future(3) })).status).toBe(409);
  });

  test('chủ trọ duyệt lịch xem', async () => {
    const list = await request(app).get('/api/v1/bookings/received?status=pending').set(bearer(S.landlord.accessToken));
    expect(list.body.data).toHaveLength(1);
    const d = await request(app).patch(`/api/v1/bookings/${S.viewing._id}/decision`).set(bearer(S.landlord.accessToken)).send({ status: 'approved', landlordNote: 'OK' });
    expect(d.body.data.status).toBe('approved');
    expect((await request(app).patch(`/api/v1/bookings/${S.viewing._id}/decision`).set(bearer(S.landlord.accessToken)).send({ status: 'rejected' })).status).toBe(400);
  });

  test('yêu cầu thuê: ngày dọn vào phải sau ngày xem ≥ 1 ngày', async () => {
    const t = S.student.accessToken; const lt = S.landlord.accessToken;
    // lịch xem ở future(2) -> dọn vào cùng ngày hoặc trước đó là sai
    const bad1 = await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'rental', moveInDate: future(2) });
    expect(bad1.status).toBe(400);
    expect((await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'rental' })).status).toBe(400); // thiếu ngày
    const rq = await request(app).post('/api/v1/bookings').set(bearer(t)).send({ room: S.room._id, type: 'rental', moveInDate: future(5) });
    expect(rq.status).toBe(201);
    expect(String(rq.body.data.viewing)).toBe(String(S.viewing._id));
    const d = await request(app).patch(`/api/v1/bookings/${rq.body.data._id}/decision`).set(bearer(lt)).send({ status: 'approved' });
    expect(d.body.data.status).toBe('approved');
  });

  test('phòng đã đánh dấu cho thuê => không nhận yêu cầu mới', async () => {
    await register('student', 2);
    const otherLogin = await request(app).post('/api/v1/auth/login').send({ email: 'student2@gmail.com', password: '123456' });
    const otherToken = otherLogin.body.data.accessToken;
    await Room.updateOne({ _id: S.room._id }, { isHidden: false }); // phòng bị ẩn sau khi duyệt yêu cầu thuê ở test trước
    await request(app).patch(`/api/v1/rooms/${S.room._id}/availability`).set(bearer(S.landlord.accessToken)).send({ availability: 'rented' });
    const again = await request(app).post('/api/v1/bookings').set(bearer(otherToken)).send({ room: S.room._id, type: 'viewing', scheduledAt: future(9) });
    expect(again.status).toBe(400);
    await request(app).patch(`/api/v1/rooms/${S.room._id}/availability`).set(bearer(S.landlord.accessToken)).send({ availability: 'available' });
  });

  test('chi tiết phòng trả myViewing cho sinh viên đã đặt lịch xem', async () => {
    await Room.updateOne({ _id: S.room._id }, { isHidden: false });
    const d = await request(app).get(`/api/v1/rooms/${S.room._id}`).set(bearer(S.student.accessToken));
    expect(d.body.data.myViewing).not.toBeNull();
    expect(String(d.body.data.myViewing._id)).toBe(String(S.viewing._id));
  });

  test('thống kê chủ trọ', async () => {
    const res = await request(app).get('/api/v1/rooms/mine/stats').set(bearer(S.landlord.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.totalRooms).toBe(2);
    expect(res.body.data.totalViews).toBeGreaterThanOrEqual(1);
  });
});

describe('Quản trị', () => {
  test('admin từ chối bài cần lý do', async () => {
    const mk = await roomForm(S.landlord.accessToken, { title: 'Phòng chờ duyệt để từ chối thử' });
    expect((await request(app).patch(`/api/v1/admin/rooms/${mk.body.data._id}/reject`).set(bearer(S.admin.accessToken)).send({})).status).toBe(400);
    const rj = await request(app).patch(`/api/v1/admin/rooms/${mk.body.data._id}/reject`).set(bearer(S.admin.accessToken)).send({ reason: 'Ảnh không rõ' });
    expect(rj.body.data.approvalStatus).toBe('rejected');
    expect(rj.body.data.rejectReason).toBe('Ảnh không rõ');
  });

  test('luồng duyệt: bài từ chối không duyệt lại / không sửa lại được; chỉ gỡ được bài đã duyệt', async () => {
    const mk = await roomForm(S.landlord.accessToken, { title: 'Phòng thử luồng duyệt bài' });
    const id = mk.body.data._id;
    const adm = (a, body) => request(app).patch(`/api/v1/admin/rooms/${id}/${a}`).set(bearer(S.admin.accessToken)).send(body || {});
    expect((await adm('remove')).status).toBe(400); // chưa duyệt thì không gỡ được
    expect((await adm('reject', { reason: 'Ảnh không rõ' })).status).toBe(200);
    expect((await adm('approve')).status).toBe(400); // đã từ chối thì không duyệt lại
    const up = await request(app).put(`/api/v1/rooms/${id}`).set(bearer(S.landlord.accessToken)).send({ price: 1700000 });
    expect(up.status).toBe(403); // chủ trọ không sửa để đăng lại
  });

  test('bài đã duyệt chỉ còn thao tác gỡ', async () => {
    const mk = await roomForm(S.landlord.accessToken, { title: 'Phòng thử gỡ bài đã duyệt' });
    const id = mk.body.data._id;
    const adm = (a, body) => request(app).patch(`/api/v1/admin/rooms/${id}/${a}`).set(bearer(S.admin.accessToken)).send(body || {});
    expect((await adm('approve')).status).toBe(200);
    expect((await adm('reject', { reason: 'Không hợp lệ' })).status).toBe(400);
    expect((await adm('remove', { reason: 'Vi phạm' })).body.data.approvalStatus).toBe('removed');
    expect((await adm('remove')).status).toBe(400);
  });

  test('khóa / mở khóa tài khoản', async () => {
    const lock = await request(app).patch(`/api/v1/admin/users/${S.student.user._id}/lock`).set(bearer(S.admin.accessToken));
    expect(lock.status).toBe(200);
    // token cũ và đăng nhập đều bị chặn
    expect((await request(app).get('/api/v1/users/me').set(bearer(S.student.accessToken))).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'student@gmail.com', password: '123456' })).status).toBe(403);
    await request(app).patch(`/api/v1/admin/users/${S.student.user._id}/unlock`).set(bearer(S.admin.accessToken));
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'student@gmail.com', password: '123456' })).status).toBe(200);
    // không khóa được admin
    const adm = await User.findOne({ role: 'admin' });
    expect((await request(app).patch(`/api/v1/admin/users/${adm._id}/lock`).set(bearer(S.admin.accessToken))).status).toBe(400);
  });

  test('danh mục: công khai xem, admin ghi, không xóa khi đang dùng', async () => {
    expect((await request(app).get('/api/v1/categories/districts')).status).toBe(200);
    expect((await request(app).post('/api/v1/categories/districts').set(bearer(S.landlord.accessToken)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).delete(`/api/v1/categories/districts/${S.district._id}`).set(bearer(S.admin.accessToken))).status).toBe(400);
    // xóa thành công => 204 No Content (không có body)
    const tmp = await request(app).post('/api/v1/categories/amenities').set(bearer(S.admin.accessToken)).send({ name: 'Tiện nghi tạm' });
    expect(tmp.status).toBe(201);
    const del = await request(app).delete(`/api/v1/categories/amenities/${tmp.body.data._id}`).set(bearer(S.admin.accessToken));
    expect(del.status).toBe(204);
    expect(del.text).toBe('');
  });

  test('thống kê admin', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set(bearer(S.admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.rentalRequests).toBeGreaterThanOrEqual(1);
    expect(res.body.data.rooms.total).toBeGreaterThanOrEqual(3);
  });
});

describe('Hệ thống', () => {
  test('health, 404, swagger', async () => {
    expect((await request(app).get('/api/v1/health')).body.status).toBe('ok');
    const nf = await request(app).get('/api/v1/khong-co');
    expect(nf.status).toBe(404);
    expect(nf.body.success).toBe(false);
    const sw = await request(app).get('/api-docs.json');
    expect(Object.keys(sw.body.paths).length).toBeGreaterThan(25);
  });

  test('phục vụ giao diện web (public/)', async () => {
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.headers['content-type']).toMatch(/html/);
    expect(home.text).toContain('Phòng Trọ Sinh Viên Hà Nội');
    for (const f of ['core', 'pages-public', 'pages-student', 'pages-manage', 'main']) {
      expect((await request(app).get(`/js/${f}.js`)).status).toBe(200);
    }
    expect((await request(app).get('/css/style.css')).status).toBe(200);
  });

  test('dọn ảnh test', async () => {
    const rooms = await Room.find();
    removeFiles(rooms.flatMap((r) => r.images));
  });
});