/* =====================================================================
   main.js - Thanh điều hướng, router (hash), xử lý sự kiện chung
   ===================================================================== */

/* ---------- Thanh điều hướng theo vai trò ---------- */
App.renderNav = () => {
  const u = App.user;
  const cur = location.hash.slice(1).split('?')[0] || '/';
  const link = (href, text, cls = '') => `<a href="#${href}" class="${cls} ${cur === href || (href !== '/' && cur.startsWith(href)) ? 'active' : ''}">${text}</a>`;
  let html = link('/', 'Tìm phòng');
  if (!u) html += link('/login', 'Đăng nhập') + `<a href="#/register" class="btn-nav">Đăng ký</a>`;
  else {
    if (u.role === 'student') html += link('/my-bookings', 'Lịch & yêu cầu');
    if (u.role === 'landlord') html += link('/landlord/stats', 'Khu vực chủ trọ');
    if (u.role === 'admin') html += link('/admin/stats', 'Quản trị');
    html += link('/profile', `👤 ${App.esc(u.name)}`) + `<button data-action="logout">Đăng xuất</button>`;
  }
  document.getElementById('nav').innerHTML = html;
};

/* ---------- Router ---------- */
App.router = async () => {
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  App.renderNav();
  document.getElementById('nav').classList.remove('open');

  for (const r of App.routes) {
    const m = path.match(r.rx);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const u = App.user;
    if (r.roles && (!u || !r.roles.includes(u.role))) {
      App.toast(u ? 'Bạn không có quyền truy cập trang này' : 'Vui lòng đăng nhập để tiếp tục', 'error');
      location.hash = u ? '#/' : '#/login';
      return;
    }
    App.render('<div class="loading">Đang tải...</div>');
    try {
      await r.handler(params, query);
    } catch (e) {
      App.render(`<div class="card error"><b>Không tải được trang.</b> ${App.esc(App.errMsg(e))}<br><a href="#/">← Về trang chủ</a></div>`);
    }
    return;
  }
  App.render(App.empty('Không tìm thấy trang (404)'));
};

/* ---------- Sự kiện dùng chung (event delegation, không dùng onclick inline vì CSP) ---------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = App.actions[el.dataset.action];
  if (!fn) return;
  if (el.dataset.confirm && !confirm(el.dataset.confirm)) return;
  try { await fn(el, e); } catch (err) { App.toast(App.errMsg(err), 'error'); }
});

document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = App.forms[f.dataset.form];
  if (!fn) return;
  const btn = f.querySelector('button:not([type=button])');
  if (btn) btn.disabled = true;
  try { await fn(f, e); } catch (err) { App.toast(App.errMsg(err), 'error'); } finally { if (btn) btn.disabled = false; }
});

document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = App.changes[el.dataset.change];
  if (fn) try { await fn(el, e); } catch (err) { App.toast(App.errMsg(err), 'error'); }
});

App.actions.logout = async () => {
  try { await App.api('/auth/logout', { method: 'POST', body: { refreshToken: localStorage.getItem('rt') } }); } catch (_) { /* bỏ qua */ }
  App.clearSession();
  App.toast('Đã đăng xuất', 'ok');
  location.hash = '#/';
  App.router();
};
App.actions['toggle-nav'] = () => document.getElementById('nav').classList.toggle('open');

window.addEventListener('hashchange', App.router);
App.router();