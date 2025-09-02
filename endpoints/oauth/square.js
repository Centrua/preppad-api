const express = require('express');
const router = express.Router();
const { Business } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

router.post('/square-callback', async (req, res) => {
  const { code, businessId } = req.body;

  const body = {
    client_id: process.env.SQUARE_APP_ID,
    client_secret: process.env.SQUARE_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: `${process.env.CALLBACK_URL}/square-callback`,
  };

  try {
    const response = await fetch('https://connect.squareupsandbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      if (businessId) {
        const business = await Business.findByPk(businessId);
        if (business) {
          business.squareAccessToken = data.access_token;
          business.squareRefreshToken = data.refresh_token;
          business.squareTokenExpiresAt = new Date(data.expires_at);
          business.squareMerchantId = data.merchant_id;
          await business.save();
        }
      }

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

router.get('/square-connection', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: business ID missing' });
    }

    const business = await Business.findByPk(businessId);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const connected = !!business.squareAccessToken;

    res.json({ connected });
  } catch (error) {
    console.error('Error checking Square connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { square: router };
