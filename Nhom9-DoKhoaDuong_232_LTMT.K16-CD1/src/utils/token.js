const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

exports.signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpires });

exports.signRefreshToken = (user) =>
  jwt.sign({ id: user._id, jti: crypto.randomBytes(8).toString('hex') }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });

exports.verifyAccessToken = (t) => jwt.verify(t, env.jwt.accessSecret);
exports.verifyRefreshToken = (t) => jwt.verify(t, env.jwt.refreshSecret);

exports.sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
exports.randomToken = () => crypto.randomBytes(32).toString('hex');
