const Joi = require('joi');

exports.objectId = Joi.string().hex().length(24).messages({
  'string.length': 'ID không hợp lệ', 'string.hex': 'ID không hợp lệ',
});

exports.idParam = Joi.object({ id: exports.objectId.required() });
exports.roomIdParam = Joi.object({ roomId: exports.objectId.required() });

exports.pageQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
};
