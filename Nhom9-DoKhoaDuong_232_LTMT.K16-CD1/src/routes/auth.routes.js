const router = require('express').Router();
const c = require('../controllers/auth.controller');
const v = require('../validators/auth');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimit');

router.post('/register', authLimiter, validate(v.register), c.register);
router.post('/login', authLimiter, validate(v.login), c.login);
router.post('/refresh-token', validate(v.refresh), c.refresh);
router.post('/logout', protect, c.logout);
router.post('/logout-all', protect, c.logoutAll);

module.exports = router;
