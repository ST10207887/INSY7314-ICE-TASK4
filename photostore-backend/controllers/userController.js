const User = require('../models/User');
const Photo = require('../models/Photo');
const HttpError = require('../util/httpError');
const { deleteImage } = require('../util/cloudinary');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users/me
async function getMe(req, res) {
  res.json(req.user);
}

// PUT /api/users/me - update username and/or email only
async function updateMe(req, res) {
  const { username, email } = req.body || {};
  if (username === undefined && email === undefined) {
    throw new HttpError(400, 'Provide a username and/or email to update');
  }

  const errors = [];
  if (username !== undefined && (typeof username !== 'string' || username.trim().length < 3)) {
    errors.push('Username must be at least 3 characters');
  }
  if (email !== undefined && !EMAIL_RE.test(String(email))) errors.push('A valid email is required');
  if (errors.length) throw new HttpError(400, 'Validation failed', errors);

  if (email !== undefined) {
    const normalised = String(email).toLowerCase().trim();
    const taken = await User.findOne({ email: normalised, _id: { $ne: req.user._id } });
    if (taken) throw new HttpError(409, 'Email already in use');
    req.user.email = normalised;
  }
  if (username !== undefined) req.user.username = username.trim();

  await req.user.save();
  res.json(req.user);
}

// GET /api/users (admin)
async function getAllUsers(_req, res) {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
}

async function findTarget(req) {
  const user = await User.findById(req.params.userId);
  if (!user) throw new HttpError(404, 'User not found');
  return user;
}

// DELETE /api/users/:userId (admin) - also removes the user's photos from Cloudinary
async function deleteUser(req, res) {
  const user = await findTarget(req);
  if (user._id.equals(req.user._id)) throw new HttpError(400, 'Administrators cannot delete their own account');

  const photos = await Photo.find({ owner: user._id });
  await Promise.allSettled(photos.map((p) => deleteImage(p.cloudinaryPublicId)));
  await Photo.deleteMany({ owner: user._id });
  await user.deleteOne();

  res.json({ message: 'User deleted', deletedPhotos: photos.length });
}

// PUT /api/users/:userId/promote (admin)
async function promoteUser(req, res) {
  const user = await findTarget(req);
  if (user.role === 'admin') throw new HttpError(400, 'User is already an administrator');
  user.role = 'admin';
  await user.save();
  res.json(user);
}

// PUT /api/users/:userId/demote (admin)
async function demoteUser(req, res) {
  const user = await findTarget(req);
  if (user._id.equals(req.user._id)) throw new HttpError(400, 'Administrators cannot demote themselves');
  if (user.role === 'user') throw new HttpError(400, 'User is not an administrator');
  user.role = 'user';
  await user.save();
  res.json(user);
}

module.exports = { getMe, updateMe, getAllUsers, deleteUser, promoteUser, demoteUser };
