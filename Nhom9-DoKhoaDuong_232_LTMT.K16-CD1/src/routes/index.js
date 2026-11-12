const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/rooms', require('./room.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/categories', require('./category.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;