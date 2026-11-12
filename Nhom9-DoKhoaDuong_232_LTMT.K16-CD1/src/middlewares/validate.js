const ApiError = require('../utils/ApiError');

// validate(schema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(ApiError.badRequest('Dữ liệu không hợp lệ', details));
  }
  if (source === 'query') {
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, value);
  } else {
    req[source] = value;
  }
  next();
};
