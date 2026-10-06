const cloudinary = require('cloudinary').v2;

// Credentials come from .env (Cloudinary dashboard > API Keys)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDER = process.env.CLOUDINARY_FOLDER || 'photostore';

/**
 * Uploads an image buffer (from multer memory storage) to Cloudinary.
 * Resolves with { secure_url, public_id }.
 */
function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Deletes an image from Cloudinary using its public ID. */
async function deleteImage(publicId) {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

module.exports = { uploadImage, deleteImage };
