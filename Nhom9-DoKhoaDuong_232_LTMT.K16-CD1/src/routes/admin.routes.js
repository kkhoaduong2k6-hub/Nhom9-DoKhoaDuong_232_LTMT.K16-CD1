const router = require('express').Router();
const c = require('../controllers/admin.controller');
const v = require('../validators/misc');
const common = require('../validators/common');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect, authorize('admin'));
const id = validate(common.idParam, 'params');

router.get('/stats', c.stats);

router.get('/users', validate(v.adminUsers, 'query'), c.listUsers);
router.patch('/users/:id/lock', id, c.lockUser);
router.patch('/users/:id/unlock', id, c.unlockUser);
router.delete('/users/:id', id, c.deleteUser);

router.get('/rooms', validate(v.adminRooms, 'query'), c.listRooms);
router.patch('/rooms/:id/approve', id, c.approveRoom);
router.patch('/rooms/:id/reject', id, validate(v.reject), c.rejectRoom);
router.patch('/rooms/:id/remove', id, c.removeRoom);

module.exports = router;