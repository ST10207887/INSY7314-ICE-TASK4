const User = require('../models/User');
const HttpError = require('../util/httpError');
const { signToken } = require('../util/token');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/signup
async function signup(req, res) {
  const { username, email, password } = req.body || {};
  const errors = [];
  if (!username || typeof username !== 'string' || username.trim().length < 3) errors.push('Username must be at least 3 characters');
  if (!email || !EMAIL_RE.test(String(email))) errors.push('A valid email is required');
  if (!password || String(password).length < 8) errors.push('Password must be at least 8 characters');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) throw new HttpError(409, 'Email already in use');

  // role is NOT taken from the request - new accounts always get the default "user" role
  const user = await User.create({ username, email, password });
  const token = signToken(user);

  res.status(201).json({ token, user });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  // same message for unknown email and wrong password (does not reveal which accounts exist)
  if (!user || !(await user.matchPassword(String(password)))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken(user);
  res.json({ token, user });
}

module.exports = { signup, login };
