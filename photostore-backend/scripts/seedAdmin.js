// Creates (or promotes) the first administrator account.
// Usage: npm run seed:admin -- admin@example.com Admin123! admin
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

(async () => {
  const [email = 'admin@photostore.com', password = 'Admin12345', username = 'admin'] = process.argv.slice(2);
  await connectDB();

  let user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.role = 'admin';
    await user.save();
    console.log(`Promoted existing user ${email} to admin`);
  } else {
    user = await User.create({ username, email, password, role: 'admin' });
    console.log(`Created admin ${email} with password ${password}`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
