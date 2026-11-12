// Sinh Postman collection từ tài liệu Swagger:  node scripts/genPostman.js
// Mỗi API có 2 request: [ĐÚNG] dữ liệu hợp lệ (mong đợi 2xx) và [SAI] dữ liệu/quyền không hợp lệ (mong đợi 4xx).
// Mỗi request có sẵn script kiểm thử (pm.test) kiểm tra mã trạng thái.
process.env.MONGODB_URI = process.env.MONGODB_URI || 'x';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'x';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'x';
const fs = require('fs');
const spec = require('../src/docs/swagger');

const sample = (schema) => {
  if (!schema) return undefined;
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).map(([k, v]) => [k, sample(v)]));
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'number' || schema.type === 'integer') return 1;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  return 'string';
};

const BEARER = { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] };
const BAD_ID = '123';          // ObjectId sai định dạng => 400
const MISSING_ID = '000000000000000000000000'; // ObjectId hợp lệ nhưng không tồn tại => 404

// Script kiểm thử gắn vào request
const okTest = [
  'pm.test("Trạng thái thành công (2xx)", () => pm.expect(pm.response.code).to.be.within(200, 299));',
  'if (pm.response.code !== 204) pm.test("JSON có success = true", () => pm.expect(pm.response.json().success).to.eql(true));',
];
const failTest = [
  'pm.test("Trạng thái lỗi (4xx)", () => pm.expect(pm.response.code).to.be.within(400, 499));',
  'pm.test("JSON có success = false", () => pm.expect(pm.response.json().success).to.eql(false));',
];
// Tự lưu token sau khi đăng nhập / đăng ký / refresh
const saveToken = [
  'const d = (pm.response.json() || {}).data || {};',
  'if (d.accessToken) pm.collectionVariables.set("accessToken", d.accessToken);',
  'if (d.refreshToken) pm.collectionVariables.set("refreshToken", d.refreshToken);',
];

const folders = {};
Object.entries(spec.paths).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, op]) => {
    const tag = op.tags[0];
    const M = method.toUpperCase();
    const pathParams = (op.parameters || []).filter((p) => p.in === 'path');
    const queryParams = (op.parameters || []).filter((p) => p.in === 'query');
    const json = op.requestBody?.content?.['application/json'];
    const form = op.requestBody?.content?.['multipart/form-data'];

    // Dựng một request; idValue: giá trị cho mọi path param; query: mảng {key,value,disabled}
    const build = ({ label, idValue, auth, body, query, tests, extraEvents = [] }) => {
      const urlPath = path.replace(/\{(\w+)\}/g, (_, k) => (idValue !== undefined ? idValue : `:${k}`));
      const qs = (query || []).filter((x) => !x.disabled).map((x) => `${x.key}=${x.value}`).join('&');
      const item = {
        name: `[${label}] ${M} ${path} - ${op.summary}`,
        request: {
          method: M,
          header: [],
          url: {
            raw: `{{baseUrl}}${urlPath}${qs ? `?${qs}` : ''}`,
            host: ['{{baseUrl}}'],
            path: urlPath.split('/').filter(Boolean),
            query: query || [],
            ...(idValue === undefined && pathParams.length ? { variable: pathParams.map((p) => ({ key: p.name, value: '' })) } : {}),
          },
          ...(auth ? { auth: BEARER } : { auth: { type: 'noauth' } }),
        },
        event: [{ listen: 'test', script: { type: 'text/javascript', exec: [...tests, ...extraEvents] } }],
      };
      if (body !== undefined) {
        item.request.header.push({ key: 'Content-Type', value: 'application/json' });
        item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
      }
      return item;
    };

    const isAuthRoute = ['/auth/login', '/auth/register', '/auth/refresh-token'].includes(path);
    const okQuery = queryParams.map((p) => ({ key: p.name, value: '', disabled: true }));
    const items = [];

    // ---------- Request ĐÚNG ----------
    const okItem = build({
      label: 'ĐÚNG', auth: !!op.security, body: json ? sample(json.schema) : undefined, query: okQuery,
      tests: okTest, extraEvents: isAuthRoute ? saveToken : [],
    });
    if (form) {
      okItem.request.body = { mode: 'formdata', formdata: Object.entries(form.schema.properties).map(([k, v]) => (v.format === 'binary' || v.type === 'array' ? { key: k, type: 'file', src: [] } : { key: k, type: 'text', value: '' })) };
    }
    items.push(okItem);

    // ---------- Request SAI (chọn ca lỗi phù hợp nhất với từng API) ----------
    if (op.security && !json && !pathParams.length && !queryParams.length && !form) {
      // API chỉ cần đăng nhập: gọi không kèm token => 401
      items.push(build({ label: 'SAI - thiếu token (401)', auth: false, tests: failTest }));
    } else if (json && json.schema.required?.length) {
      // Thiếu trường bắt buộc => 400
      items.push(build({ label: 'SAI - thiếu dữ liệu bắt buộc (400)', auth: !!op.security, idValue: pathParams.length ? MISSING_ID : undefined, body: {}, tests: failTest }));
    } else if (pathParams.length) {
      // ID sai định dạng => 400
      items.push(build({ label: 'SAI - ID không hợp lệ (400)', auth: !!op.security, idValue: BAD_ID, body: json ? {} : undefined, tests: failTest }));
    } else if (op.security) {
      items.push(build({ label: 'SAI - thiếu token (401)', auth: false, body: json ? {} : undefined, tests: failTest }));
    } else if (queryParams.length) {
      // Danh sách có phân trang: page âm => 400
      items.push(build({ label: 'SAI - tham số truy vấn không hợp lệ (400)', auth: false, query: [{ key: 'page', value: '-1' }], tests: failTest }));
    } else {
      // API công khai không có đầu vào: gọi tới tài nguyên không tồn tại => 404
      items.push(build({ label: 'SAI - tài nguyên không tồn tại (404)', auth: false, idValue: undefined, tests: failTest }));
      const last = items[items.length - 1];
      last.request.url.raw += `/${MISSING_ID}`;
      last.request.url.path.push(MISSING_ID);
    }

    (folders[tag] = folders[tag] || []).push(...items);
  });
});

const collection = {
  info: {
    name: 'Phòng Trọ SV Hà Nội API',
    description: 'Mỗi API có 1 request [ĐÚNG] và 1 request [SAI], kèm script kiểm thử. Chạy theo thứ tự thư mục: Auth (đăng nhập để lưu token) trước, sau đó điền ID vào các biến đường dẫn của request [ĐÚNG].',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'baseUrl', value: 'http://localhost:5000/api/v1' }, { key: 'accessToken', value: '' }, { key: 'refreshToken', value: '' }],
  item: Object.entries(folders).map(([name, item]) => ({ name, item })),
};
fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/postman_collection.json', JSON.stringify(collection, null, 2));
console.log(`Đã tạo docs/postman_collection.json (${Object.values(folders).flat().length} request)`);