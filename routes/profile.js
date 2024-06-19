const express = require('express');
const authMiddleware = require('../midddleware/authMiddleware');
const User = require('../models/User');
const router = express.Router();

// Profile route - Protected by authMiddleware
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); // Exclude the password field
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;