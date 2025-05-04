const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const delaySchedule = [0, 30, 60, 180]; // in seconds

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ msg: "User not found" });

    const now = new Date();
    const lastAttempt = user.lastLoginAttempt || new Date(0);
    const attempts = user.loginAttempts;

    const delay = delaySchedule[Math.min(attempts, 3)] * 1000;

    if (now - lastAttempt < delay) {
      const waitTime = Math.ceil((delay - (now - lastAttempt)) / 1000);
      return res.status(429).json({ msg: `Too many attempts. Try again in ${waitTime}s.` });
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      user.loginAttempts += 1;
      user.lastLoginAttempt = new Date();
      await user.save();
      return res.status(401).json({ msg: "Invalid credentials." });
    }

    // Success: reset login attempts
    user.loginAttempts = 0;
    user.lastLoginAttempt = null;
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.access }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error." });
  }
};
