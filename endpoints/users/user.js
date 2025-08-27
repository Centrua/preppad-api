const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Business } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.fullName, role: user.role, businessId: user.businessId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /signup
router.post('/signup', async (req, res) => {
  const { username, fullName, email, password, businessName } = req.body;

  if (!username || !fullName || !email || !password || !businessName) {
    return res.status(400).json({ error: 'Username, fullName, email, password, and businessName are required' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    let business = await Business.findOne({ where: { name: businessName } });
    if (!business) {
      business = await Business.create({ name: businessName });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      fullName,
      email,
      passwordHash,
      businessId: business.id,
      role: 'user',
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        businessId: user.businessId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const where = {};
    if (req.query.businessId) where.businessId = req.query.businessId;
    const users = await User.findAll({ where });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = { user: router };
