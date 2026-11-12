const Joi = require('joi');
const { objectId, pageQuery } = require('./common');

exports.createBooking = Joi.object({
  room: objectId.required(),
  type: Joi.string().valid('viewing', 'rental').required(),
  scheduledAt: Joi.date().greater('now')
    .messages({ 'date.greater': 'Thời gian xem phòng phải lớn hơn thời gian hiện tại', 'date.base': 'Thời gian xem phòng không hợp lệ' })
    .when('type', { is: 'viewing', then: Joi.required(), otherwise: Joi.forbidden() }),
  moveInDate: Joi.date()
    .messages({ 'date.base': 'Ngày dự kiến dọn vào không hợp lệ' })
    .when('type', { is: 'rental', then: Joi.required(), otherwise: Joi.forbidden() }),
});

exports.decide = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  landlordNote: Joi.string().max(1000).allow(''),
});

exports.listBookings = Joi.object({
  ...pageQuery,
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled'),
  type: Joi.string().valid('viewing', 'rental'),
});
