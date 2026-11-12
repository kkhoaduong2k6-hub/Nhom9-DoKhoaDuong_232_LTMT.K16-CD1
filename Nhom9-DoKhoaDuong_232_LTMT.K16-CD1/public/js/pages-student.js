/* =====================================================================
   pages-student.js - Lịch/yêu cầu của tôi, hồ sơ
   ===================================================================== */

App.route('/my-bookings', async (p, q) => {
  const { data, pagination } = await App.api('/bookings/mine', { query: { page: q.page, limit: 10 } });
  App.render(`<h1>📅 Lịch xem & yêu cầu thuê của tôi</h1>
    <div class="card tablewrap">${data.length ? `<table>
      <tr><th>Phòng</th><th>Loại</th><th>Thời gian</th><th>Trạng thái</th><th>Phản hồi chủ trọ</th><th></th></tr>
      ${data.map((b) => `<tr>
        <td><a href="#/room/${b.room?._id}">${App.esc(b.room?.title || '(phòng đã xóa)')}</a></td>
        <td>${b.type === 'viewing' ? 'Xem phòng' : 'Thuê phòng'}</td>
        <td>${b.type === 'viewing' ? App.datetime(b.scheduledAt) : `Dọn vào: ${App.date(b.moveInDate)}${b.viewing ? `<div class="muted">Xem phòng: ${App.datetime(b.viewing.scheduledAt)}</div>` : ''}`}</td>
        <td>${App.badge(App.BOOKING, b.status)}</td>
        <td>${App.esc(b.landlordNote || '')}</td>
        <td>${b.status === 'pending' ? `<button class="btn danger sm" data-action="cancel-booking" data-id="${b._id}" data-confirm="Hủy yêu cầu này?">Hủy</button>` : ''}</td>
      </tr>`).join('')}</table>${App.pager(pagination)}` : App.empty('Chưa có yêu cầu nào.')}</div>`);
}, ['student']);
App.actions['cancel-booking'] = async (el) => {
  await App.api(`/bookings/${el.dataset.id}/cancel`, { method: 'PATCH' });
  App.toast('Đã hủy yêu cầu', 'ok'); App.router();
};

/* ---------- Hồ sơ (mọi vai trò) ---------- */
App.route('/profile', async () => {
  const { data: u } = await App.api('/users/me');
  const roleName = { student: 'Sinh viên', landlord: 'Chủ trọ', admin: 'Quản trị viên' }[u.role];
  App.render(`<h1>👤 Hồ sơ cá nhân</h1>
    <div class="row" style="align-items:flex-start">
      <div class="card"><h3>Thông tin</h3>
        <p><span class="badge">${roleName}</span> ${App.esc(u.email)}</p>
        <form data-form="profile">
          <label>Họ tên</label><input name="name" value="${App.esc(u.name)}" required minlength="2">
         <input name="phone" value="${App.esc(u.phone || '')}" required inputmode="numeric" pattern="0[0-9]{9}" maxlength="10" title="Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0">
          <button class="btn" style="margin-top:12px">Lưu thay đổi</button>
        </form>
      </div>
      <div class="card"><h3>Đổi mật khẩu</h3>
        <form data-form="password">
          <label>Mật khẩu hiện tại</label><input type="password" name="currentPassword" required>
          <label>Mật khẩu mới</label><input type="password" name="newPassword" required minlength="6">
          <button class="btn" style="margin-top:12px">Đổi mật khẩu</button>
        </form>
      </div>
    </div>`);
}, ['student', 'landlord', 'admin']);

App.forms.profile = async (f) => {
  const d = App.formData(f);
  const { data } = await App.api('/users/me', { method: 'PUT', body: d });
  App.setSession({ user: data });
  App.renderNav();
  App.toast('Đã cập nhật hồ sơ', 'ok');
};
App.forms.password = async (f) => {
  await App.api('/users/me/password', { method: 'PUT', body: App.formData(f) });
  App.clearSession(); App.renderNav();
  App.toast('Đổi mật khẩu thành công, vui lòng đăng nhập lại', 'ok');
  location.hash = '#/login';
};