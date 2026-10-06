const mongoose = require('mongoose');
const HttpError = require('../util/httpError');

// Returns 400 for malformed ids such as /api/photos/abc
module.exports = (param) => (req, _res, next) => {
  if (!mongoose.isValidObjectId(req.params[param])) {
    return next(new HttpError(400, `Invalid ${param}`));
  }
  next();
};
