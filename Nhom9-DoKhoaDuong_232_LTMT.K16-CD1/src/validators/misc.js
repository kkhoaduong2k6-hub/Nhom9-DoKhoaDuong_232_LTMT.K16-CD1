const Joi = require('joi');
const { pageQuery } = require('./common');

exports.adminUsers = Joi.object({
  ...pageQuery,
  role: Joi.string().valid('student', 'landlord', 'admin'),
  isActive: Joi.boolean(),
  q: Joi.string().trim().max(100),
});
exports.adminRooms = Joi.object({
  ...pageQuery,
  approvalStatus: Joi.string().valid('pending', 'approved', 'rejected', 'removed'),
  q: Joi.string().trim().max(100),
});
exports.reject = Joi.object({ reason: Joi.string().trim().min(3).max(500).required() });

exports.district = Joi.object({ name: Joi.string().trim().required() });
exports.amenity = Joi.object({ name: Joi.string().trim().required(), icon: Joi.string().allow('') });