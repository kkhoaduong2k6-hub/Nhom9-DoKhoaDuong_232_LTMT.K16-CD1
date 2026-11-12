const Joi = require('joi');
const { objectId, pageQuery } = require('./common');

const ROOM_TYPES = ['private', 'shared', 'mini_apartment', 'dormitory'];

const base = {
  title: Joi.string().trim().min(10).max(150),
  description: Joi.string().trim().max(5000).allow(''),
  price: Joi.number().min(0),
  area: Joi.number().min(1),
  address: Joi.string().trim(),
  district: objectId,
  roomType: Joi.string().valid(...ROOM_TYPES),
  amenities: Joi.array().items(objectId).single(),
  electricityPrice: Joi.number().min(0),
  waterPrice: Joi.number().min(0),
  maxPeople: Joi.number().integer().min(1).max(20),
};

exports.createRoom = Joi.object({
  ...base,
  title: base.title.required(),
  price: base.price.required(),
  area: base.area.required(),
  address: base.address.required(),
  district: base.district.required(),
  roomType: base.roomType.required(),
});

exports.updateRoom = Joi.object(base);

exports.setAvailability = Joi.object({ availability: Joi.string().valid('available', 'rented').required() });
exports.removeImage = Joi.object({ image: Joi.string().required() });

const csvIds = Joi.alternatives().try(
  Joi.array().items(objectId),
  Joi.string().custom((v, h) => {
    const arr = v.split(',').map((s) => s.trim()).filter(Boolean);
    return arr.every((x) => /^[a-f\d]{24}$/i.test(x)) ? arr : h.error('any.invalid');
  })
).messages({ 'any.invalid': 'Danh sách ID không hợp lệ' });

exports.searchRooms = Joi.object({
  ...pageQuery,
  district: csvIds,
  roomType: Joi.alternatives().try(
    Joi.string().valid(...ROOM_TYPES),
    Joi.string().custom((v, h) => {
      const arr = v.split(',').map((s) => s.trim());
      return arr.every((x) => ROOM_TYPES.includes(x)) ? arr : h.error('any.invalid');
    })
  ),
  amenities: csvIds,
  maxPeople: Joi.number().integer().min(1),
  availability: Joi.string().valid('available', 'rented', 'all').default('available'),
});