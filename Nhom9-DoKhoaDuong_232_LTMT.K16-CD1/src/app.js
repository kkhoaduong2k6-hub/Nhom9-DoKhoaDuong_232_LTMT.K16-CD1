const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const routes = require('./routes');
const swaggerSpec = require('./docs/swagger');
const { UPLOAD_DIR } = require('./middlewares/upload');
const { globalLimiter } = require('./middlewares/rateLimit');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();

app.set('trust proxy', 1); // Render/Railway đứng sau reverse proxy
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // cho phép FE khác origin hiển thị ảnh
  contentSecurityPolicy: {
    directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:', 'https:'], 'upgrade-insecure-requests': null },
  },
}));
app.use(cors({
  origin: env.clientUrl === '*' ? true : env.clientUrl.split(',').map((s) => s.trim()),
  credentials: true,
}));
if (!env.isProd && env.nodeEnv !== 'test') app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'public'))); // giao diện web (HTML/CSS/JS thuần)

// Swagger UI cần nới CSP (helmet mặc định chặn inline script/style)
app.use('/api-docs', (req, res, next) => { res.removeHeader('Content-Security-Policy'); next(); },
  swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Phòng Trọ SV - API Docs' }));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;