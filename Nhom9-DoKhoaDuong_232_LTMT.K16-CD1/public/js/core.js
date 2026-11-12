/* =====================================================================
   core.js - tiện ích chung, gọi API (tự refresh token), session, toast
   Mọi thứ gắn vào đối tượng toàn cục App để các file khác dùng chung.
   ===================================================================== */
const App = (window.App = { actions: {}, forms: {}, changes: {} });

/* ---------- Tiện ích ---------- */
App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
App.money = (n) => `${new Intl.NumberFormat('vi-VN').format(n || 0)} đ`;
App.date = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
App.datetime = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '');
App.localYmd = (d) => { if (!d) return ''; const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
App.dist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

App.TYPES = { private: 'Phòng riêng', shared: 'Ở ghép', mini_apartment: 'Chung cư mini', dormitory: 'Ký túc xá' };
App.APPROVAL = { pending: ['Chờ duyệt', 'warn'], approved: ['Đã duyệt', 'ok'], rejected: ['Bị từ chối', 'bad'], removed: ['Đã gỡ', 'gray'] };
App.BOOKING = { pending: ['Chờ xử lý', 'warn'], approved: ['Đã duyệt', 'ok'], rejected: ['Từ chối', 'bad'], cancelled: ['Đã hủy', 'gray'] };
App.badge = (map, key) => { const [t, c] = map[key] || [key, 'gray']; return `<span class="badge ${c}">${App.esc(t)}</span>`; };

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" fill="#9ca3af" font-size="22" font-family="sans-serif" text-anchor="middle">Chưa có ảnh</text></svg>';
App.PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(SVG)}`;
App.img = (p) => App.esc(p || App.PLACEHOLDER);

App.errMsg = (e) => {
  const extra = e.errors && e.errors.length ? `: ${e.errors.map((x) => x.message).join('; ')}` : '';
  return (e.message || 'Có lỗi xảy ra') + extra;
};

App.toast = (msg, type = '') => {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
};
App.render = (html) => { document.getElementById('app').innerHTML = html; };

// Gom dữ liệu form; bỏ các ô để trống (để Joi không báo lỗi "number" với chuỗi rỗng)
App.formData = (form) => {
  const out = {};
  new FormData(form).forEach((v, k) => {
    if (v === '' || v instanceof File) return;
    if (out[k] !== undefined) out[k] = [].concat(out[k], v); else out[k] = v;
  });
  return out;
};

/* ---------- Phiên đăng nhập ---------- */
Object.defineProperty(App, 'user', { get: () => JSON.parse(localStorage.getItem('user') || 'null') });
App.setSession = (d) => {
  if (d.accessToken) localStorage.setItem('at', d.accessToken);
  if (d.refreshToken) localStorage.setItem('rt', d.refreshToken);
  if (d.user) localStorage.setItem('user', JSON.stringify(d.user));
};
App.clearSession = () => { ['at', 'rt', 'user'].forEach((k) => localStorage.removeItem(k)); };

/* ---------- Gọi API ---------- */
let refreshing = null;
App.refresh = () => {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh-token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: localStorage.getItem('rt') }),
    }).then(async (r) => {
      if (!r.ok) return false;
      App.setSession((await r.json()).data);
      return true;
    }).catch(() => false).finally(() => { refreshing = null; });
  }
  return refreshing;
};

// App.api('/rooms', { method, body (JSON), form (FormData), query })
// Lưu ý: phản hồi 204 (xóa thành công) không có body => trả về {}
App.api = async (path, opt = {}, retry = true) => {
  const { method = 'GET', body, form, query } = opt;
  let url = `/api/v1${path}`;
  if (query) {
    const p = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.append(k, v); });
    if (p.toString()) url += `?${p}`;
  }
  const headers = {};
  const at = localStorage.getItem('at');
  if (at) headers.Authorization = `Bearer ${at}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  const res = await fetch(url, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));

  // access token hết hạn => thử refresh 1 lần rồi gọi lại
  if (res.status === 401 && retry && localStorage.getItem('rt') && !path.startsWith('/auth/')) {
    if (await App.refresh()) return App.api(path, opt, false);
    App.clearSession();
    App.renderNav();
  }
  if (!res.ok) {
    const e = new Error(data.message || 'Có lỗi xảy ra');
    e.status = res.status; e.errors = data.errors;
    throw e;
  }
  return data;
};

/* ---------- Danh mục (cache) ---------- */
let catPromise = null;
App.cats = () => {
  if (!catPromise) {
    catPromise = Promise.all([
      App.api('/categories/districts'), App.api('/categories/amenities')
    ]).then(([d, a]) => ({ districts: d.data, amenities: a.data }));
  }
  return catPromise;
};
App.resetCats = () => { catPromise = null; };

/* ---------- Thành phần giao diện dùng lại ---------- */
App.options = (list, selected, label = 'name') =>
  list.map((x) => `<option value="${x._id}" ${String(selected) === String(x._id) ? 'selected' : ''}>${App.esc(x[label])}</option>`).join('');

App.roomCard = (r) => `
  <a class="room-card" href="#/room/${r._id}">
    <img src="${App.img(r.images && r.images[0])}" alt="" loading="lazy">
    <div class="body">
      <div class="title">${App.esc(r.title)}</div>
      <div class="price">${App.money(r.price)}<span class="muted"> /tháng</span></div>
      <div class="muted">${r.area} m² · ${App.esc(r.district?.name || '')} · ${App.TYPES[r.roomType] || ''}</div>
      <div>
        ${r.distance != null ? `<span class="badge">📍 ${App.dist(r.distance)}</span>` : ''}
        ${r.availability === 'rented' ? '<span class="badge bad">Đã cho thuê</span>' : '<span class="badge ok">Còn trống</span>'}
      </div>
    </div>
  </a>`;

App.pager = (p, action = 'page') => {
  if (!p || p.totalPages <= 1) return '';
  const pages = [];
  for (let i = 1; i <= p.totalPages; i++) {
    if (i === 1 || i === p.totalPages || Math.abs(i - p.page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  return `<div class="pager">${pages.map((i) => (i === '…' ? '<span>…</span>' : `<button data-action="${action}" data-page="${i}" class="${i === p.page ? 'on' : ''}">${i}</button>`)).join('')}</div>`;
};

App.tabs = (base, tabs, active) =>
  `<div class="tabs">${tabs.map(([k, t]) => `<a href="#/${base}/${k}" class="${k === active ? 'active' : ''}">${t}</a>`).join('')}</div>`;

App.empty = (msg) => `<div class="empty">${App.esc(msg)}</div>`;

// Router đăng ký trang
App.routes = [];
App.route = (pattern, handler, roles) => {
  const keys = [];
  const rx = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  App.routes.push({ rx, keys, handler, roles });
};