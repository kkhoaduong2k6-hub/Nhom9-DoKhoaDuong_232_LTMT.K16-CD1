/* =====================================================================
   pages-manage.js - Khu vực CHỦ TRỌ (/landlord/...) và ADMIN (/admin/...)
   ===================================================================== */

const LL_TABS = [['stats', '📊 Thống kê'], ['rooms', '🏠 Phòng của tôi'], ['bookings', '📅 Yêu cầu nhận được']];
const llHead = (active) => `<div class="between"><h1>Khu vực chủ trọ</h1><a class="btn" href="#/landlord/new">+ Đăng phòng mới</a></div>${App.tabs('landlord', LL_TABS, active)}`;
const statCard = (label, val) => `<div class="stat"><span class="muted">${label}</span><b>${val}</b></div>`;

/* ---------- Form phòng dùng chung cho đăng mới / sửa ---------- */
function roomFormHtml(c, r = null) {
  const have = (r?.amenities || []).map((a) => String(a._id || a));
  const v = (x, d = '') => App.esc(r ? r[x] ?? d : d);
  return `
    <label>Tiêu đề (tối thiểu 10 ký tự)</label><input name="title" required minlength="10" maxlength="150" value="${v('title')}">
    <label>Mô tả</label><textarea name="description" rows="4">${v('description')}</textarea>
    <div class="row">
      <div><label>Giá thuê (đ/tháng)</label><input type="number" name="price" min="0" required value="${v('price')}"></div>
      <div><label>Diện tích (m²)</label><input type="number" name="area" min="1" required value="${v('area')}"></div>
      <div><label>Số người tối đa</label><input type="number" name="maxPeople" min="1" max="20" value="${v('maxPeople', 2)}"></div>
    </div>
    <div class="row">
      <div><label>Quận/huyện</label><select name="district" required><option value="">-- Chọn --</option>${App.options(c.districts, r?.district?._id || r?.district)}</select></div>
      <div><label>Loại phòng</label><select name="roomType" required>${Object.entries(App.TYPES).map(([k, t]) => `<option value="${k}" ${r?.roomType === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    </div>
    <label>Địa chỉ</label><input name="address" required value="${v('address')}">
    <div class="row">
      <div><label>Giá điện (đ/kWh)</label><input type="number" name="electricityPrice" min="0" value="${v('electricityPrice')}"></div>
      <div><label>Giá nước (đ)</label><input type="number" name="waterPrice" min="0" value="${v('waterPrice')}"></div>
    </div>
    <label>Tiện nghi</label>
    <div class="checks">${c.amenities.map((a) => `<label><input type="checkbox" name="amenities" value="${a._id}" ${have.includes(String(a._id)) ? 'checked' : ''}> ${App.esc(a.name)}</label>`).join('')}</div>`;
}
// Bỏ ô trống để Joi không báo lỗi; giữ file ảnh thật
const cleanForm = (form) => {
  const out = new FormData();
  new FormData(form).forEach((v, k) => {
    if (v instanceof File ? v.size === 0 : v === '') return;
    out.append(k, v);
  });
  return out;
};

/* ---------- Chủ trọ ---------- */
App.route('/landlord/new', async () => {
  const c = await App.cats();
  App.render(`<p><a href="#/landlord/rooms">← Phòng của tôi</a></p><h1>Đăng phòng mới</h1>
    <form class="card" data-form="room-new">${roomFormHtml(c)}
      <label>Ảnh phòng (tối đa 10 ảnh, mỗi ảnh ≤ 5MB)</label>
      <input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple>
      <p class="muted">Bài đăng sẽ ở trạng thái "Chờ duyệt" cho đến khi quản trị viên duyệt.</p>
      <button class="btn" style="margin-top:8px">Đăng phòng</button></form>`);
}, ['landlord']);
App.forms['room-new'] = async (f) => {
  await App.api('/rooms', { method: 'POST', form: cleanForm(f) });
  App.toast('Đăng phòng thành công, chờ quản trị viên duyệt', 'ok');
  location.hash = '#/landlord/rooms';
};

App.route('/landlord/edit/:id', async ({ id }) => {
  const [c, { data: r }] = await Promise.all([App.cats(), App.api(`/rooms/${id}`)]);
  App.render(`<p><a href="#/landlord/rooms">← Phòng của tôi</a></p><h1>Sửa phòng</h1>
    ${r.approvalStatus === 'approved' ? '<div class="card">⚠️ Sửa nội dung sẽ đưa bài về trạng thái chờ duyệt lại.</div>' : ''}
    <form class="card" data-form="room-edit" data-id="${r._id}">${roomFormHtml(c, r)}<button class="btn" style="margin-top:12px">Lưu thay đổi</button></form>
    <div class="card"><h3>Ảnh phòng (${r.images.length})</h3>
      <div class="imgs-edit">${r.images.map((i) => `<figure><img src="${App.img(i)}" alt=""><button class="btn danger sm" data-action="del-img" data-id="${r._id}" data-img="${App.esc(i)}" data-confirm="Xóa ảnh này?">×</button></figure>`).join('') || '<span class="muted">Chưa có ảnh</span>'}</div>
      <form data-form="add-imgs" data-id="${r._id}" style="margin-top:12px">
        <input type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple required>
        <button class="btn outline sm" style="margin-top:8px">Thêm ảnh</button></form>
    </div>`);
}, ['landlord']);
App.forms['room-edit'] = async (f) => {
  const d = App.formData(f);
  d.amenities = [].concat(d.amenities || []);
  await App.api(`/rooms/${f.dataset.id}`, { method: 'PUT', body: d });
  App.toast('Đã lưu thay đổi', 'ok');
  location.hash = '#/landlord/rooms';
};
App.forms['add-imgs'] = async (f) => {
  await App.api(`/rooms/${f.dataset.id}/images`, { method: 'POST', form: new FormData(f) });
  App.toast('Đã thêm ảnh', 'ok'); App.router();
};
App.actions['del-img'] = async (el) => {
  await App.api(`/rooms/${el.dataset.id}/images`, { method: 'DELETE', body: { image: el.dataset.img } });
  App.toast('Đã xóa ảnh', 'ok'); App.router();
};

App.route('/landlord/:tab', async ({ tab }, q) => {
  if (tab === 'stats') {
    const { data: s } = await App.api('/rooms/mine/stats');
    const st = s.roomsByApprovalStatus;
    return App.render(`${llHead(tab)}
      <div class="stats">${statCard('Tổng số phòng', s.totalRooms)}${statCard('Tổng lượt xem', s.totalViews)}
        ${statCard('Yêu cầu chờ xử lý', s.pendingBookings)}</div>
      <div class="card"><h3>Trạng thái bài đăng</h3>${Object.keys(st).length ? Object.entries(st).map(([k, n]) => `${App.badge(App.APPROVAL, k)} ${n} &nbsp;`).join('') : '<span class="muted">Chưa có bài đăng</span>'}</div>
      <div class="card"><h3>Phòng xem nhiều nhất</h3>${s.topViewedRooms.length ? `<table><tr><th>Phòng</th><th>Lượt xem</th></tr>${s.topViewedRooms.map((r) => `<tr><td><a href="#/room/${r._id}">${App.esc(r.title)}</a></td><td>${r.views}</td></tr>`).join('')}</table>` : '<span class="muted">Chưa có dữ liệu</span>'}</div>`);
  }
  if (tab === 'rooms') {
    const { data, pagination } = await App.api('/rooms/mine/list', { query: { page: q.page, limit: 10 } });
    return App.render(`${llHead(tab)}<div class="card tablewrap">${data.length ? `<table>
      <tr><th>Phòng</th><th>Giá</th><th>Trạng thái</th><th>Lượt xem</th><th>Thao tác</th></tr>
      ${data.map((r) => `<tr>
        <td><a href="#/room/${r._id}">${App.esc(r.title)}</a><div class="muted">${App.esc(r.district?.name || '')}</div></td>
        <td>${App.money(r.price)}</td>
        <td>${App.badge(App.APPROVAL, r.approvalStatus)}<br>${r.availability === 'rented' ? '<span class="badge bad">Đã thuê</span>' : '<span class="badge ok">Còn trống</span>'}${r.isHidden ? '<span class="badge gray">Đang ẩn</span>' : ''}
          ${r.rejectReason ? `<div class="muted">Lý do: ${App.esc(r.rejectReason)}</div>` : ''}</td>
        <td>${r.views}</td>
                <td>${['rejected', 'removed'].includes(r.approvalStatus) ? '' : `<a class="btn outline sm" href="#/landlord/edit/${r._id}">Sửa</a>`} 
          <button class="btn outline sm" data-action="toggle-hidden" data-id="${r._id}">${r.isHidden ? 'Hiện' : 'Ẩn'}</button>
          <button class="btn outline sm" data-action="set-avail" data-id="${r._id}" data-to="${r.availability === 'rented' ? 'available' : 'rented'}">${r.availability === 'rented' ? 'Đánh dấu còn trống' : 'Đánh dấu đã thuê'}</button>
          <button class="btn danger sm" data-action="del-room" data-id="${r._id}" data-confirm="Xóa phòng này vĩnh viễn?">Xóa</button></td>
      </tr>`).join('')}</table>${App.pager(pagination)}` : App.empty('Bạn chưa đăng phòng nào.')}</div>`);
  }
  if (tab === 'bookings') {
    const { data, pagination } = await App.api('/bookings/received', { query: { page: q.page, limit: 10, status: q.status } });
    const filters = [['', 'Tất cả'], ['pending', 'Chờ xử lý'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']];
    return App.render(`${llHead(tab)}
      <div class="tabs">${filters.map(([k, t]) => `<a href="#/landlord/bookings${k ? `?status=${k}` : ''}" class="${(q.status || '') === k ? 'active' : ''}">${t}</a>`).join('')}</div>
      <div class="card tablewrap">${data.length ? `<table>
      <tr><th>Sinh viên</th><th>Phòng</th><th>Loại</th><th>Thời gian</th><th>Trạng thái</th><th>Thao tác</th></tr>
      ${data.map((b) => `<tr>
        <td><b>${App.esc(b.student?.name || '')}</b><div class="muted">${App.esc(b.student?.phone || '')}<br>${App.esc(b.student?.email || '')}</div></td>
        <td>${App.esc(b.room?.title || '')}</td>
        <td>${b.type === 'viewing' ? 'Xem phòng' : 'Thuê phòng'}</td>
        <td>${b.type === 'viewing' ? `🕒 ${App.datetime(b.scheduledAt)}` : `Dọn vào: ${App.date(b.moveInDate)}${b.viewing ? `<div class="muted">Xem phòng: ${App.datetime(b.viewing.scheduledAt)}</div>` : ''}`}</td>
        <td>${App.badge(App.BOOKING, b.status)}</td>
        <td>${b.status === 'pending' ? `
            <button class="btn ok sm" data-action="decide" data-id="${b._id}" data-status="approved">Duyệt</button>
            <button class="btn danger sm" data-action="decide" data-id="${b._id}" data-status="rejected">Từ chối</button>` : ''}</td>
      </tr>`).join('')}</table>${App.pager(pagination)}` : App.empty('Chưa có yêu cầu nào.')}</div>`);
  }
  App.render(App.empty('Không tìm thấy trang'));
}, ['landlord']);

App.actions['toggle-hidden'] = async (el) => { await App.api(`/rooms/${el.dataset.id}/toggle-hidden`, { method: 'PATCH' }); App.toast('Đã cập nhật', 'ok'); App.router(); };
App.actions['set-avail'] = async (el) => { await App.api(`/rooms/${el.dataset.id}/availability`, { method: 'PATCH', body: { availability: el.dataset.to } }); App.toast('Đã cập nhật', 'ok'); App.router(); };
App.actions['del-room'] = async (el) => { await App.api(`/rooms/${el.dataset.id}`, { method: 'DELETE' }); App.toast('Đã xóa phòng', 'ok'); App.router(); };
App.actions.decide = async (el) => {
  const note = prompt('Ghi chú gửi sinh viên (có thể để trống):');
  if (note === null) return;
  await App.api(`/bookings/${el.dataset.id}/decision`, { method: 'PATCH', body: { status: el.dataset.status, landlordNote: note } });
  App.toast('Đã xử lý yêu cầu', 'ok'); App.router();
};

/* ---------- Admin ---------- */
const AD_TABS = [['stats', '📊 Thống kê'], ['rooms', '✅ Duyệt bài đăng'], ['users', '👥 Người dùng'], ['categories', '🗂 Danh mục']];
const adHead = (active) => `<h1>Quản trị hệ thống</h1>${App.tabs('admin', AD_TABS, active)}`;

App.route('/admin/:tab', async ({ tab }, q) => {
  if (tab === 'stats') {
    const { data: s } = await App.api('/admin/stats');
    const u = s.users.byRole; const r = s.rooms.byApprovalStatus;
    return App.render(`${adHead(tab)}
      <div class="stats">${statCard('Người dùng', s.users.total)}${statCard('Tổng bài đăng', s.rooms.total)}${statCard('Yêu cầu thuê', s.rentalRequests)}
        ${statCard('Lịch xem phòng', s.viewingRequests)}</div>
      <div class="row" style="align-items:flex-start">
        <div class="card"><h3>Người dùng theo vai trò</h3>Sinh viên: <b>${u.student || 0}</b> · Chủ trọ: <b>${u.landlord || 0}</b> · Admin: <b>${u.admin || 0}</b></div>
        <div class="card"><h3>Bài đăng theo trạng thái</h3>${Object.entries(r).map(([k, n]) => `${App.badge(App.APPROVAL, k)} ${n} `).join('') || '—'}</div>
      </div>
      <div class="card tablewrap"><h3>Phòng đã duyệt theo quận</h3>${s.roomsByDistrict.length ? `<table><tr><th>Quận/huyện</th><th>Số phòng</th><th>Giá trung bình</th></tr>
        ${s.roomsByDistrict.map((d) => `<tr><td>${App.esc(d.district || '—')}</td><td>${d.rooms}</td><td>${App.money(d.avgPrice)}</td></tr>`).join('')}</table>` : '<span class="muted">Chưa có dữ liệu</span>'}</div>`);
  }
  if (tab === 'rooms') {
    const status = q.status === undefined ? 'pending' : q.status;
    const { data, pagination } = await App.api('/admin/rooms', { query: { page: q.page, limit: 10, approvalStatus: status } });
    const filters = [['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối'], ['removed', 'Đã gỡ'], ['', 'Tất cả']];
    return App.render(`${adHead(tab)}
      <div class="tabs">${filters.map(([k, t]) => `<a href="#/admin/rooms?status=${k}" class="${status === k ? 'active' : ''}">${t}</a>`).join('')}</div>
      <div class="card tablewrap">${data.length ? `<table>
      <tr><th>Phòng</th><th>Chủ trọ</th><th>Giá</th><th>Trạng thái</th><th>Thao tác</th></tr>
      ${data.map((r) => `<tr>
        <td><a href="#/room/${r._id}">${App.esc(r.title)}</a><div class="muted">${App.esc(r.address)}, ${App.esc(r.district?.name || '')}</div></td>
        <td>${App.esc(r.landlord?.name || '')}<div class="muted">${App.esc(r.landlord?.email || '')}</div></td>
        <td>${App.money(r.price)}</td><td>${App.badge(App.APPROVAL, r.approvalStatus)}</td>
        <td>${r.approvalStatus === 'pending' ? `<button class="btn ok sm" data-action="room-approve" data-id="${r._id}">Duyệt</button>
          <button class="btn danger sm" data-action="room-reject" data-id="${r._id}">Từ chối</button>` : ''}
          ${r.approvalStatus === 'approved' ? `<button class="btn outline sm" data-action="room-remove" data-id="${r._id}">Gỡ bài</button>` : ''}
          ${['rejected', 'removed'].includes(r.approvalStatus) ? '<span class="muted">—</span>' : ''}</td>
      </tr>`).join('')}</table>${App.pager(pagination)}` : App.empty('Không có bài đăng nào.')}</div>`);
  }
  if (tab === 'users') {
    const { data, pagination } = await App.api('/admin/users', { query: { page: q.page, limit: 15, role: q.role, q: q.q } });
    return App.render(`${adHead(tab)}
      <form class="card row" data-form="user-filter"><div><label>Tìm (tên, email, SĐT)</label><input name="q" value="${App.esc(q.q || '')}"></div>
        <div><label>Vai trò</label><select name="role"><option value="">Tất cả</option>${['student', 'landlord', 'admin'].map((x) => `<option ${q.role === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
        <div style="align-self:end"><button class="btn">Lọc</button></div></form>
      <div class="card tablewrap"><table><tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr>
      ${data.map((u) => `<tr><td>${App.esc(u.name)}</td><td>${App.esc(u.email)}</td><td>${App.esc(u.phone || '')}</td><td>${u.role}</td><td>${App.date(u.createdAt)}</td>
        <td>${u.isActive ? '<span class="badge ok">Hoạt động</span>' : '<span class="badge bad">Đã khóa</span>'}</td>
        <td>${u.role === 'admin' ? '' : `${u.isActive ? `<button class="btn danger sm" data-action="user-lock" data-id="${u._id}" data-to="lock" data-confirm="Khóa tài khoản này?">Khóa</button>` : `<button class="btn ok sm" data-action="user-lock" data-id="${u._id}" data-to="unlock">Mở khóa</button>`}
          <button class="btn danger sm" data-action="user-delete" data-id="${u._id}" data-confirm="Xóa vĩnh viễn tài khoản này cùng dữ liệu liên quan (phòng, lịch xem, yêu cầu thuê)? Không thể hoàn tác.">Xóa</button>`}</td></tr>`).join('')}
      </table>${App.pager(pagination)}</div>`);
  }
  if (tab === 'categories') {
    App.resetCats();
    const c = await App.cats();
    const list = (kind, items, extra = () => '') => items.map((i) => `<tr><td>${App.esc(i.name)}${extra(i)}</td><td><button class="btn danger sm" data-action="cat-del" data-kind="${kind}" data-id="${i._id}" data-confirm="Xóa mục này?">Xóa</button></td></tr>`).join('');
    return App.render(`${adHead(tab)}<div class="row" style="align-items:flex-start">
      <div class="card"><h3>Quận/huyện (${c.districts.length})</h3>
        <form data-form="cat-add" data-kind="districts" class="row"><input name="name" placeholder="Tên quận/huyện" required><button class="btn sm" style="flex:0">Thêm</button></form>
        <table>${list('districts', c.districts)}</table></div>
      <div class="card"><h3>Tiện nghi (${c.amenities.length})</h3>
        <form data-form="cat-add" data-kind="amenities" class="row"><input name="name" placeholder="Tên tiện nghi" required><button class="btn sm" style="flex:0">Thêm</button></form>
        <table>${list('amenities', c.amenities)}</table></div>
    </div>`);
  }
  App.render(App.empty('Không tìm thấy trang'));
}, ['admin']);

App.actions['room-approve'] = async (el) => { await App.api(`/admin/rooms/${el.dataset.id}/approve`, { method: 'PATCH' }); App.toast('Đã duyệt bài', 'ok'); App.router(); };
App.actions['room-reject'] = async (el) => {
  const reason = prompt('Lý do từ chối (bắt buộc):');
  if (!reason) return;
  await App.api(`/admin/rooms/${el.dataset.id}/reject`, { method: 'PATCH', body: { reason } });
  App.toast('Đã từ chối bài', 'ok'); App.router();
};
App.actions['room-remove'] = async (el) => {
  const reason = prompt('Lý do gỡ bài:', 'Vi phạm quy định đăng bài');
  if (reason === null) return;
  await App.api(`/admin/rooms/${el.dataset.id}/remove`, { method: 'PATCH', body: { reason } });
  App.toast('Đã gỡ bài', 'ok'); App.router();
};
App.actions['user-lock'] = async (el) => { await App.api(`/admin/users/${el.dataset.id}/${el.dataset.to}`, { method: 'PATCH' }); App.toast('Đã cập nhật tài khoản', 'ok'); App.router(); };
App.actions['user-delete'] = async (el) => { await App.api(`/admin/users/${el.dataset.id}`, { method: 'DELETE' }); App.toast('Đã xóa tài khoản', 'ok'); App.router(); };
App.forms['user-filter'] = (f) => {
  const p = new URLSearchParams(); new FormData(f).forEach((v, k) => { if (v) p.set(k, v); });
  location.hash = `#/admin/users?${p}`;
};
App.forms['cat-add'] = async (f) => {
  await App.api(`/categories/${f.dataset.kind}`, { method: 'POST', body: App.formData(f) });
  App.toast('Đã thêm', 'ok'); App.router();
};
App.actions['cat-del'] = async (el) => { await App.api(`/categories/${el.dataset.kind}/${el.dataset.id}`, { method: 'DELETE' }); App.toast('Đã xóa', 'ok'); App.router(); };