const jwt = require('jsonwebtoken');

// JWT payload contains the user ID and role; "exp" (expiry time) is added by expiresIn
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

module.exports = { signToken };
