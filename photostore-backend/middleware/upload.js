const multer = require('multer');
const HttpError = require('../util/httpError');

const MAX_SIZE_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Files are kept in memory and streamed straight to Cloudinary (nothing is written to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, `Only image files are allowed (${ALLOWED.join(', ')})`));
  },
});

module.exports = { upload, MAX_SIZE_MB };
