const Photo = require('../models/Photo');
const HttpError = require('../util/httpError');
const { uploadImage, deleteImage } = require('../util/cloudinary');

const OWNER_FIELDS = 'username email role';

function validateText({ title, description }, requireTitle) {
  const errors = [];
  if (requireTitle && (!title || !String(title).trim())) errors.push('Title is required');
  if (title !== undefined && String(title).trim().length > 100) errors.push('Title may not exceed 100 characters');
  if (title !== undefined && !requireTitle && !String(title).trim()) errors.push('Title cannot be empty');
  if (description !== undefined && String(description).length > 1000) errors.push('Description may not exceed 1000 characters');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);
}

const isOwner = (photo, user) => photo.owner._id.equals(user._id);

async function findPhoto(id) {
  const photo = await Photo.findById(id).populate('owner', OWNER_FIELDS);
  if (!photo) throw new HttpError(404, 'Photo not found');
  return photo;
}

// GET /api/photos - the logged-in user's gallery
async function getMyPhotos(req, res) {
  const photos = await Photo.find({ owner: req.user._id })
    .populate('owner', OWNER_FIELDS)
    .sort({ createdAt: -1 });
  res.json(photos);
}

// GET /api/photos/all - every uploaded photo (admin)
async function getAllPhotos(_req, res) {
  const photos = await Photo.find().populate('owner', OWNER_FIELDS).sort({ createdAt: -1 });
  res.json(photos);
}

// POST /api/photos - multipart/form-data: image, title, description
async function createPhoto(req, res) {
  if (!req.file) throw new HttpError(400, 'An image file is required (form field "image")');
  validateText(req.body || {}, true);

  const { secure_url, public_id } = await uploadImage(req.file.buffer);

  try {
    const photo = await Photo.create({
      title: req.body.title,
      description: req.body.description,
      imageUrl: secure_url,
      cloudinaryPublicId: public_id,
      owner: req.user._id,
    });
    await photo.populate('owner', OWNER_FIELDS);
    res.status(201).json(photo);
  } catch (err) {
    await deleteImage(public_id).catch(() => {}); // do not leave an orphaned image in Cloudinary
    throw err;
  }
}

// PUT /api/photos/:photoId - title, description and/or a new image (owner only)
async function updatePhoto(req, res) {
  const photo = await findPhoto(req.params.photoId);
  if (!isOwner(photo, req.user)) throw new HttpError(403, 'You can only update your own photos');

  const body = req.body || {};
  if (body.title === undefined && body.description === undefined && !req.file) {
    throw new HttpError(400, 'Provide a title, description or image to update');
  }
  validateText(body, false);

  if (body.title !== undefined) photo.title = body.title;
  if (body.description !== undefined) photo.description = body.description;

  let oldPublicId;
  if (req.file) {
    // upload the replacement first, then delete the previous asset once the record is updated
    const { secure_url, public_id } = await uploadImage(req.file.buffer);
    oldPublicId = photo.cloudinaryPublicId;
    photo.imageUrl = secure_url;
    photo.cloudinaryPublicId = public_id;
  }

  await photo.save();
  if (oldPublicId) await deleteImage(oldPublicId).catch((e) => console.error('Cloudinary delete failed', e));

  res.json(photo);
}

// DELETE /api/photos/:photoId - owner or administrator
async function deletePhoto(req, res) {
  const photo = await findPhoto(req.params.photoId);
  if (!isOwner(photo, req.user) && req.user.role !== 'admin') {
    throw new HttpError(403, 'Only the owner or an administrator may delete this photo');
  }

  await deleteImage(photo.cloudinaryPublicId);
  await photo.deleteOne();
  res.json({ message: 'Photo deleted', id: photo._id });
}

module.exports = { getMyPhotos, getAllPhotos, createPhoto, updatePhoto, deletePhoto };
