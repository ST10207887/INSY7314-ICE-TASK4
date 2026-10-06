const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HttpError = require('../util/httpError');

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * Loads the current user (so role changes / deleted accounts take effect immediately).
 */
async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Not authorised - a bearer token is required'));
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token has expired' : 'Token is invalid';
    return next(new HttpError(401, msg));
  }

  const user = await User.findById(payload.id);
  if (!user) return next(new HttpError(401, 'The account for this token no longer exists'));

  req.user = user;
  next();
}

/** Allows only administrators through. Use after protect. */
function adminOnly(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(new HttpError(403, 'Forbidden - administrator access required'));
  }
  next();
}

module.exports = { protect, adminOnly };
