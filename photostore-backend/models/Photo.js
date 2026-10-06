const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title may not exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description may not exceed 1000 characters'],
      default: '',
    },
    // public secure delivery URL returned by Cloudinary
    imageUrl: { type: String, required: true },
    // Cloudinary asset identifier - kept so the image can later be deleted or replaced
    cloudinaryPublicId: { type: String, required: true },
    // the user who uploaded the image
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

photoSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Photo', photoSchema);
