const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Business } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Get all businesses
app.get('/businesses', async (req, res) => {
  try {
    const businesses = await Business.findAll();
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// Get business by ID with users
app.get('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findByPk(req.params.id, {
      include: User,
    });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// Get users (optional filter by businessId)
app.get('/users', async (req, res) => {
  try {
    const where = {};
    if (req.query.businessId) where.businessId = req.query.businessId;
    const users = await User.findAll({ where });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new business
app.post('/businesses', async (req, res) => {
  try {
    const business = await Business.create({ name: req.body.name });
    res.status(201).json(business);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create business' });
  }
});

app.post('/login', async (req, res) => {
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
      { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
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

app.post('/signup', async (req, res) => {
  const { username, fullName, email, password, businessName } = req.body;

  // Basic validation
  if (!username || !fullName || !email || !password || !businessName) {
    return res.status(400).json({ error: 'Username, fullName, email, password, and businessName are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Optionally: Check if business exists
    let business = await Business.findOne({ where: { name: businessName } });
    if (!business) {
      business = await Business.create({ name: businessName });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      fullName,
      email,
      passwordHash,
      businessId: business.id,
      role: 'user', // default role; adjust if needed
    });

    // Respond with created user info (no password)
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

app.post('/square/oauth-callback', async (req, res) => {
  const { code } = req.body;

  const body = {
    client_id: process.env.SQUARE_APP_ID,
    client_secret: process.env.SQUARE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: 'http://localhost:3000/square-callback',
  };

  try {
    const response = await fetch('https://connect.squareupsandbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      res.json(data);
    } else {
      console.error('OAuth error:', data);
      res.status(400).json({ error: 'OAuth failed', details: data });
    }
  } catch (error) {
    console.error('OAuth exception:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
