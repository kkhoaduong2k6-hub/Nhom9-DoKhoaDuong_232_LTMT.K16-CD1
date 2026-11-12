const router = require('express').Router();
const c = require('../controllers/room.controller');
const v = require('../validators/room');
const common = require('../validators/common');
const validate = require('../middlewares/validate');
const { protect, optionalAuth, authorize } = require('../middlewares/auth');
const { uploadRoomImages } = require('../middlewares/upload');

// multipart gửi amenities dạng "id1,id2" hoặc lặp field => chuẩn hóa thành mảng
const normalizeForm = (req, res, next) => {
  const a = req.body.amenities ?? req.body['amenities[]'];
  if (a !== undefined) req.body.amenities = typeof a === 'string' ? a.split(',').map((s) => s.trim()).filter(Boolean) : a;
  delete req.body['amenities[]'];
  next();
};

// Công khai
router.get('/', validate(v.searchRooms, 'query'), c.search);

// Chủ trọ (đặt trước '/:id' để không bị nuốt)
const landlord = [protect, authorize('landlord', 'admin')];
router.get('/mine/list', protect, authorize('landlord'), c.myRooms);
router.get('/mine/stats', protect, authorize('landlord'), c.landlordStats);
router.post('/', protect, authorize('landlord'), uploadRoomImages, normalizeForm, validate(v.createRoom), c.create);

router.get('/:id', validate(common.idParam, 'params'), optionalAuth, c.getById);
router.put('/:id', ...landlord, validate(common.idParam, 'params'), validate(v.updateRoom), c.update);
router.delete('/:id', ...landlord, validate(common.idParam, 'params'), c.remove);
router.patch('/:id/toggle-hidden', protect, authorize('landlord'), validate(common.idParam, 'params'), c.toggleHidden);
router.patch('/:id/availability', protect, authorize('landlord'), validate(common.idParam, 'params'), validate(v.setAvailability), c.setAvailability);
router.post('/:id/images', protect, authorize('landlord'), validate(common.idParam, 'params'), uploadRoomImages, c.addImages);
router.delete('/:id/images', protect, authorize('landlord'), validate(common.idParam, 'params'), validate(v.removeImage), c.removeImage);

module.exports = router;