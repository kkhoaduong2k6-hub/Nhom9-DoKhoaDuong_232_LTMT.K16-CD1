/* =====================================================================
   pages-public.js - Trang chủ (tìm kiếm), chi tiết phòng, đăng nhập/đăng ký
   ===================================================================== */

/* ---------- Trang chủ: tìm kiếm & lọc ---------- */
App.route('/', async (params, q) => {
  const c = await App.cats();
  const amSel = (q.amenities || '').split(',');
  App.render(`
    <div class="hero">
      <h1>Tìm phòng trọ sinh viên Hà Nội</h1>
      <p>Lọc theo quận, loại phòng và tiện nghi.</p>
    </div>
    <div class="layout">
      <form class="card" data-form="search">
        <h3>Bộ lọc</h3>
        <label>Quận/huyện</label>
        <select name="district"><option value="">Tất cả</option>${App.options(c.districts, q.district)}</select>
        <label>Loại phòng</label>
        <select name="roomType"><option value="">Tất cả</option>
          ${Object.entries(App.TYPES).map(([k, v]) => `<option value="${k}" ${q.roomType === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <label>Tiện nghi</label>
        <div class="checks">${c.amenities.map((a) => `<label><input type="checkbox" name="amenities" value="${a._id}" ${amSel.includes(a._id) ? 'checked' : ''}> ${App.esc(a.name)}</label>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button class="btn" type="submit">Tìm kiếm</button><a class="btn outline" href="#/">Xóa lọc</a></div>
      </form>
      <section><div id="results" class="loading">Đang tải...</div></section>
    </div>`);

  const res = await App.api('/rooms', { query: { ...q, limit: 12 } });
  const { data, pagination: p } = res;
  document.getElementById('results').outerHTML = `
    <div id="results">
      <div class="between" style="margin-bottom:10px"><b>${p.total} phòng phù hợp</b><span class="muted">Trang ${p.page}/${p.totalPages}</span></div>
      ${data.length ? `<div class="grid">${data.map(App.roomCard).join('')}</div>` : App.empty('Không tìm thấy phòng phù hợp. Hãy thử nới điều kiện lọc.')}
      ${App.pager(p)}
    </div>`;
});

App.forms.search = (form) => {
  const p = new URLSearchParams();
  const fd = new FormData(form);
  const am = fd.getAll('amenities');
  fd.delete('amenities');
  fd.forEach((v, k) => { if (v !== '') p.set(k, v); });
  if (am.length) p.set('amenities', am.join(','));
  location.hash = `#/?${p}`;
};

App.actions.page = (el) => {
  const [path, qs] = (location.hash.slice(1) || '/').split('?');
  const p = new URLSearchParams(qs || '');
  p.set('page', el.dataset.page);
  location.hash = `#${path}?${p}`;
};

/* ---------- Chi tiết phòng ---------- */
App.route('/room/:id', async ({ id }) => {
  const user = App.user;
  const { data: r } = await App.api(`/rooms/${id}`);
  const isStudent = user && user.role === 'student';
  const isOwner = user && String(r.landlord._id) === String(user._id);
  const imgs = r.images && r.images.length ? r.images : [null];

  // Ngày nhỏ nhất được chọn cho "dọn vào" = ngày xem phòng + 1 ngày
  const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const minMoveIn = r.myViewing ? ymd(new Date(new Date(r.myViewing.scheduledAt).getTime() + 86400000)) : '';

  const actions = isStudent ? `
    <div class="card">
      <h3>Đặt lịch & thuê phòng</h3>
      ${r.availability === 'available' ? `
        <form data-form="book-viewing" data-room="${r._id}">
          <label>Đặt lịch xem phòng (phải sau thời điểm hiện tại)</label><input type="datetime-local" name="scheduledAt" min="${nowLocal}" required>
          <button class="btn" style="width:100%;margin-top:8px">Đặt lịch xem</button>
        </form>
        ${r.myViewing ? `
        <form data-form="book-rental" data-room="${r._id}">
          <p class="muted">Lịch xem của bạn: <b>${App.datetime(r.myViewing.scheduledAt)}</b></p>
          <label>Ngày dự kiến dọn vào (phải sau ngày xem phòng ít nhất 1 ngày)</label><input type="date" name="moveInDate" min="${minMoveIn}" required>
          <button class="btn ok" style="width:100%;margin-top:8px">Gửi yêu cầu thuê</button>
        </form>` : '<p class="muted">Hãy đặt lịch xem phòng trước, sau đó bạn mới có thể gửi yêu cầu thuê.</p>'}` : '<p class="muted">Phòng này đã được cho thuê.</p>'}
    </div>`
    : isOwner ? `<div class="card"><a class="btn" href="#/landlord/edit/${r._id}">✏️ Chỉnh sửa phòng này</a></div>`
    : !user ? `<div class="card">Bạn cần <a href="#/login">đăng nhập</a> bằng tài khoản sinh viên để đặt lịch xem hoặc gửi yêu cầu thuê.</div>` : '';

  App.render(`
    <p><a href="#/">← Quay lại tìm kiếm</a></p>
    ${r.approvalStatus !== 'approved' ? `<div class="card error">Bài đăng này đang ở trạng thái: ${App.badge(App.APPROVAL, r.approvalStatus)} ${App.esc(r.rejectReason || '')}</div>` : ''}
    <div class="detail">
      <div>
        <div class="gallery card">
          <img id="mainimg" class="main" src="${App.img(imgs[0])}" alt="">
          ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((i, n) => `<img src="${App.img(i)}" data-action="thumb" class="${n ? '' : 'on'}" alt="">`).join('')}</div>` : ''}
        </div>
        <div class="card">
          <h1>${App.esc(r.title)}</h1>
          <div class="price" style="font-size:22px">${App.money(r.price)} <span class="muted">/tháng</span></div>
          <p>${r.availability === 'rented' ? '<span class="badge bad">Đã cho thuê</span>' : '<span class="badge ok">Còn trống</span>'}
          <span class="badge">${App.TYPES[r.roomType]}</span>
          <span class="badge gray">👁 ${r.views} lượt xem</span></p>
          <dl class="kv">
            <dt>Địa chỉ</dt><dd>${App.esc(r.address)}, ${App.esc(r.district?.name || '')}</dd>
            <dt>Diện tích</dt><dd>${r.area} m²</dd>
            <dt>Số người tối đa</dt><dd>${r.maxPeople}</dd>
            <dt>Giá điện</dt><dd>${App.money(r.electricityPrice)} /kWh</dd>
            <dt>Giá nước</dt><dd>${App.money(r.waterPrice)}</dd>
          </dl>
          <h3 style="margin-top:14px">Tiện nghi</h3>
          <div>${(r.amenities || []).map((a) => `<span class="badge">${App.esc(a.name)}</span>`).join('') || '<span class="muted">Chưa cập nhật</span>'}</div>
          <h3 style="margin-top:14px">Mô tả</h3>
          <p style="white-space:pre-wrap">${App.esc(r.description || 'Chưa có mô tả.')}</p>
        </div>
      </div>
      <aside>
        <div class="card"><h3>Chủ trọ</h3>
          <b>${App.esc(r.landlord.name)}</b>
          <div>📞 ${App.esc(r.landlord.phone || 'Chưa cập nhật')}</div>
          <div class="muted">${App.esc(r.landlord.email || '')}</div>
        </div>
        ${actions}
      </aside>
    </div>`);
});

App.actions.thumb = (el) => {
  document.getElementById('mainimg').src = el.src;
  document.querySelectorAll('.thumbs img').forEach((i) => i.classList.toggle('on', i === el));
};
App.forms['book-viewing'] = async (f) => {
  const d = App.formData(f);
  if (new Date(d.scheduledAt) <= new Date()) throw new Error('Thời gian xem phòng phải lớn hơn thời gian hiện tại');
  await App.api('/bookings', { method: 'POST', body: { room: f.dataset.room, type: 'viewing', scheduledAt: new Date(d.scheduledAt).toISOString() } });
  App.toast('Đã gửi lịch xem phòng, chờ chủ trọ xác nhận', 'ok');
  App.router();
};
App.forms['book-rental'] = async (f) => {
  const d = App.formData(f);
  await App.api('/bookings', { method: 'POST', body: { room: f.dataset.room, type: 'rental', moveInDate: d.moveInDate } });
  App.toast('Đã gửi yêu cầu thuê, chờ chủ trọ duyệt', 'ok');
  App.router();
};

/* ---------- Đăng nhập / đăng ký ---------- */
const afterLogin = (user) => {
  App.renderNav();
  location.hash = user.role === 'admin' ? '#/admin/stats' : user.role === 'landlord' ? '#/landlord/stats' : '#/';
};

App.route('/login', () => App.render(`
  <div class="card narrow"><h1>Đăng nhập</h1>
    <form data-form="login">
      <label>Email</label><input type="email" name="email" required placeholder="ten@gmail.com">
      <label>Mật khẩu</label><input type="password" name="password" required>
      <button class="btn" style="width:100%;margin-top:14px">Đăng nhập</button>
    </form>
    <p class="muted">Chưa có tài khoản? <a href="#/register">Đăng ký</a></p>
  </div>`));
App.forms.login = async (f) => {
  const { data } = await App.api('/auth/login', { method: 'POST', body: App.formData(f) });
  App.setSession(data);
  App.toast(`Xin chào ${data.user.name}`, 'ok');
  afterLogin(data.user);
};

App.route('/register', () => App.render(`
  <div class="card narrow"><h1>Đăng ký</h1>
    <form data-form="register">
      <label>Bạn là</label>
      <select name="role"><option value="student">Sinh viên (tìm phòng)</option><option value="landlord">Chủ trọ (cho thuê)</option></select>
      <label>Họ tên</label><input name="name" required minlength="2">
      <label>Email (đuôi @gmail.com)</label><input type="email" name="email" required pattern="[A-Za-z0-9._%+-]+@[Gg][Mm][Aa][Ii][Ll][.][Cc][Oo][Mm]" title="Email phải có đuôi @gmail.com" placeholder="ten@gmail.com">
      <label>Số điện thoại (10 số, bắt đầu bằng 0)</label><input name="phone" required inputmode="numeric" pattern="0[0-9]{9}" maxlength="10" title="Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0" placeholder="0912345678">
      <label>Mật khẩu (tối thiểu 6 ký tự)</label><input type="password" name="password" required minlength="6">
      <button class="btn" style="width:100%;margin-top:14px">Tạo tài khoản</button>
    </form>
    <p class="muted">Đã có tài khoản? <a href="#/login">Đăng nhập</a></p>
  </div>`));
App.forms.register = async (f) => {
  await App.api('/auth/register', { method: 'POST', body: App.formData(f) });
  App.clearSession();
  App.toast('Đăng ký thành công, vui lòng đăng nhập', 'ok');
  location.hash = '#/login'; // không tự đăng nhập
};