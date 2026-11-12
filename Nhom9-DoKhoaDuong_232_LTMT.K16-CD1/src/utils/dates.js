// Quy đổi thời điểm sang "số ngày" theo giờ Việt Nam (UTC+7) để so sánh theo ngày lịch.
const DAY = 86400000;
const VN_OFFSET = 7 * 3600 * 1000;

exports.DAY = DAY;
exports.vnDay = (d) => Math.floor((new Date(d).getTime() + VN_OFFSET) / DAY);
exports.fmt = (d) => new Date(new Date(d).getTime() + VN_OFFSET).toISOString().slice(0, 10).split('-').reverse().join('/');
