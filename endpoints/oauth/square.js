const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { Business } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

const CATALOG_URL = 'https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM';
const INVENTORY_URL = 'https://connect.squareupsandbox.com/v2/inventory/batch-retrieve-counts';

router.post('/oauth-callback', async (req, res) => {
  const { code, businessId } = req.body;

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

router.get('/inventory/items', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const catalogRes = await fetch(CATALOG_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!catalogRes.ok) throw new Error(await catalogRes.text());

    const catalogData = await catalogRes.json();
    const items = catalogData.objects || [];

    const variationIdMap = {};
    const variationIds = [];

    const inventoryItems = items.map(item => {
      const { id: item_id, item_data } = item;
      const { name, description, variations = [] } = item_data;

      const formattedVariations = variations.map(variation => {
        const { id: variation_id, item_variation_data } = variation;
        variationIdMap[variation_id] = true;
        variationIds.push(variation_id);

        return {
          variation_id,
          name: item_variation_data.name,
          price: item_variation_data.price_money?.amount
            ? item_variation_data.price_money.amount / 100
            : null,
          track_inventory: item_variation_data.track_inventory,
          stockable: item_variation_data.stockable,
          location_inventory: item_variation_data.location_overrides || [],
          current_count: null,
        };
      });

      return {
        item_id,
        name,
        description,
        variations: formattedVariations,
      };
    });

    const inventoryRes = await fetch(INVENTORY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ catalog_object_ids: variationIds }),
    });

    if (!inventoryRes.ok) throw new Error(await inventoryRes.text());

    const inventoryData = await inventoryRes.json();

    const countMap = {};
    (inventoryData.counts || []).forEach(count => {
      const { catalog_object_id, quantity, location_id } = count;
      if (!countMap[catalog_object_id]) countMap[catalog_object_id] = {};
      countMap[catalog_object_id][location_id] = quantity;
    });

    inventoryItems.forEach(item => {
      item.variations.forEach(variation => {
        const locCounts = countMap[variation.variation_id] || {};
        variation.current_count = locCounts;
      });
    });

    res.json(inventoryItems);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch inventory data' });
  }
});

module.exports = { square: router };
