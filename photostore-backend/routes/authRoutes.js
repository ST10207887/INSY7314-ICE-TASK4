const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signup, login } = require('../controllers/authController');

// limit brute-force attempts on the auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 100),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);

module.exports = router;
