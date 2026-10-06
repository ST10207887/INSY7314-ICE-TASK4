const router = require('express').Router();
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const validateObjectId = require('../middleware/validateObjectId');
const c = require('../controllers/photoController');

router.use(protect);

router.get('/', c.getMyPhotos);
router.get('/all', adminOnly, c.getAllPhotos);
router.post('/', upload.single('image'), c.createPhoto);
router.put('/:photoId', validateObjectId('photoId'), upload.single('image'), c.updatePhoto);
router.delete('/:photoId', validateObjectId('photoId'), c.deletePhoto);

module.exports = router;
