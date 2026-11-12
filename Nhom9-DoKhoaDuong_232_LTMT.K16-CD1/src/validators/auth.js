const Joi = require('joi');

const password = Joi.string().min(6).max(64).messages({
  'string.min': 'Mật khẩu tối thiểu 6 ký tự',
  'string.empty': 'Mật khẩu là bắt buộc',
});
// Số điện thoại: đúng 10 chữ số, bắt đầu bằng 0
const phone = Joi.string().pattern(/^0\d{9}$/).messages({
  'string.pattern.base': 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
  'string.empty': 'Số điện thoại là bắt buộc',
});
// Email: bắt buộc đuôi @gmail.com
const gmail = Joi.string().trim().lowercase().pattern(/^[a-z0-9._%+-]+@gmail\.com$/).messages({
  'string.pattern.base': 'Email phải có đuôi @gmail.com',
  'string.empty': 'Email là bắt buộc',
});

exports.register = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: gmail.required(),
  password: password.required(),
  phone: phone.required(),
  role: Joi.string().valid('student', 'landlord').default('student'), // admin không đăng ký công khai
});

exports.login = Joi.object({
  email: Joi.string().trim().lowercase().required(),
  password: Joi.string().required(),
});

exports.refresh = Joi.object({ refreshToken: Joi.string().required() });

exports.updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(80),
  phone,
}).min(1);

exports.changePassword = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password.required(),
});