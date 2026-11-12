const router = require('express').Router();
const c = require('../controllers/booking.controller');
const v = require('../validators/booking');
const common = require('../validators/common');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);
router.post('/', authorize('student'), validate(v.createBooking), c.create);
router.get('/mine', authorize('student'), validate(v.listBookings, 'query'), c.mine);
router.get('/received', authorize('landlord'), validate(v.listBookings, 'query'), c.forLandlord);
router.patch('/:id/decision', authorize('landlord'), validate(common.idParam, 'params'), validate(v.decide), c.decide);
router.patch('/:id/cancel', authorize('student'), validate(common.idParam, 'params'), c.cancel);

module.exports = router;
