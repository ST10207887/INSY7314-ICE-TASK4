const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username may not exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true, // normalised to lower case
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is not valid'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // the hash is never returned unless explicitly requested
    },
    role: {
      type: String,
      enum: { values: ['user', 'admin'], message: 'Role must be user or admin' },
      default: 'user', // new accounts are normal users
    },
  },
  { timestamps: true } // createdAt and updatedAt
);

// Hash the password whenever it is set or changed (never store the original)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Remove sensitive/internal fields from every JSON response
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
