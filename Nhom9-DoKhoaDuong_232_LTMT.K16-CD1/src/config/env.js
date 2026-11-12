require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
required.forEach((k) => {
  if (!process.env[k]) {
    console.error(`Thiếu biến môi trường bắt buộc: ${k} (xem .env.example)`);
    process.exit(1);
  }
});

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  clientUrl: process.env.CLIENT_URL || '*',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
};
