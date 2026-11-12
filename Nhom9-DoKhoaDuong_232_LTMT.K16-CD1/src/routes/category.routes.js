const router = require('express').Router();
const factory = require('../controllers/category.controller');
const { District, Amenity } = require('../models/categories');
const v = require('../validators/misc');
const common = require('../validators/common');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

const build = (path, Model, label, schema, opts) => {
  const c = factory(Model, label, opts);
  router.get(`/${path}`, c.list); // công khai
  router.post(`/${path}`, protect, authorize('admin'), validate(schema), c.create);
  router.put(`/${path}/:id`, protect, authorize('admin'), validate(common.idParam, 'params'), validate(schema), c.update);
  router.delete(`/${path}/:id`, protect, authorize('admin'), validate(common.idParam, 'params'), c.remove);
};

build('districts', District, 'quận/huyện', v.district, { usedBy: factory.usage.district });
build('amenities', Amenity, 'tiện nghi', v.amenity, { usedBy: factory.usage.amenity });

module.exports = router;