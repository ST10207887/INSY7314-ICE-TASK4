const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const c = require('../controllers/userController');

router.use(protect);

router.get('/me', c.getMe);
router.put('/me', c.updateMe);

// administrator routes
router.get('/', adminOnly, c.getAllUsers);
router.delete('/:userId', adminOnly, validateObjectId('userId'), c.deleteUser);
router.put('/:userId/promote', adminOnly, validateObjectId('userId'), c.promoteUser);
router.put('/:userId/demote', adminOnly, validateObjectId('userId'), c.demoteUser);

module.exports = router;
