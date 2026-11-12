const router = require('express').Router();
const c = require('../controllers/user.controller');
const v = require('../validators/auth');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/me', c.getMe);
router.put('/me', validate(v.updateProfile), c.updateMe);
router.put('/me/password', validate(v.changePassword), c.changePassword);

module.exports = router;
