const { Business } = require('../models');
const { Op } = require('sequelize');

async function refreshSquareTokenIfExpiringSoon() {
  const businesses = await Business.findAll({
    where: {
      squareRefreshToken: { [Op.ne]: null },
      squareTokenExpiresAt: { [Op.ne]: null },
    },
  });

  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  for (const business of businesses) {
    const expiresAt = new Date(business.squareTokenExpiresAt);
    const timeUntilExpiration = expiresAt.getTime() - now.getTime();

    if (timeUntilExpiration <= ONE_DAY_MS) {
      try {
        const refreshed = await refreshSquareToken(business.squareRefreshToken);

        business.squareAccessToken = refreshed.access_token;
        business.squareRefreshToken = refreshed.refresh_token;
        business.squareTokenExpiresAt = new Date(refreshed.expires_at);
        business.squareMerchantId = refreshed.merchant_id;
        await business.save();

        console.log(`Refreshed token for business ${business.id}`);
      } catch (err) {
        console.error(`Failed to refresh token for business ${business.id}:`, err.message);
      }
    }
  }
}

async function refreshSquareToken(refresh_token) {
  const body = {
    client_id: process.env.SQUARE_APP_ID,
    client_secret: process.env.SQUARE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token,
  };

  const response = await fetch(`https://${process.env.SQUARE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
  }

  return data;
}

module.exports = { refreshSquareTokenIfExpiringSoon };