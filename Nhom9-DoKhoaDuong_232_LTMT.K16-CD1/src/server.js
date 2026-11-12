const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

(async () => {
  try {
    await connectDB();
    const server = app.listen(env.port, () => {
      console.log(`🚀 Server chạy tại http://localhost:${env.port}  |  Docs: http://localhost:${env.port}/api-docs`);
    });
    const shutdown = (sig) => () => {
      console.log(`${sig} nhận được, đang tắt server...`);
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown('SIGTERM'));
    process.on('SIGINT', shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Không thể khởi động server:', err.message);
    process.exit(1);
  }
})();

process.on('unhandledRejection', (err) => { console.error('UnhandledRejection:', err); process.exit(1); });
