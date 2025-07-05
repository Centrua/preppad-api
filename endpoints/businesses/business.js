const express = require('express');
const router = express.Router();
const { Business, User } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

router.post('/', authenticateJWT, async (req, res) => {
  try {
    const business = await Business.create({ name: req.body.name });
    res.status(201).json(business);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create business' });
  }
});

router.get('/', authenticateJWT, async (req, res) => {
  try {
    const businesses = await Business.findAll();
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

router.get('/:id', authenticateJWT, async (req, res) => {
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

module.exports = { business: router };