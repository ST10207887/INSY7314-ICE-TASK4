const mongoose = require('mongoose');
const multer = require('multer');
const { MAX_SIZE_MB } = require('./upload');

// 404 for unknown routes
function notFound(req, _res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

// Central error handler - always returns { message, details? } JSON
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || { value: '' })[0]} already in use`;
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `Image may not be larger than ${MAX_SIZE_MB} MB` : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body must be valid JSON';
  }

  if (status >= 500) {
    console.error(err);
    message = 'Server error'; // do not leak internal details
    details = undefined;
  }

  res.status(status).json(details ? { message, details } : { message });
}

module.exports = { notFound, errorHandler };
