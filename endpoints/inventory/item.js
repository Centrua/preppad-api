const express = require('express');
const router = express.Router();
const { Item, Business } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

const CATALOG_URL = 'https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM';
const INVENTORY_URL = 'https://connect.squareupsandbox.com/v2/inventory/batch-retrieve-counts';

// Main sync function
async function syncSquareInventoryToDB(accessToken, businessId) {
  try {
    const catalogRes = await fetch(CATALOG_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!catalogRes.ok) {
      const text = await catalogRes.text();
      throw new Error(`Failed to fetch catalog: ${text}`);
    }

    const catalogData = await catalogRes.json();
    const items = catalogData.objects || [];

    const variationIds = [];
    const inventoryItems = items.map(item => {
      const { id: item_id, item_data } = item;
      const { name, description, variations = [] } = item_data;

      const formattedVariations = variations.map(variation => {
        const { id: variation_id, item_variation_data } = variation;
        variationIds.push(variation_id);

        return {
          variation_id,
          name: item_variation_data.name,
          price: item_variation_data.price_money?.amount
            ? item_variation_data.price_money.amount / 100
            : 0,
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ catalog_object_ids: variationIds }),
    });

    if (!inventoryRes.ok) {
      const text = await inventoryRes.text();
      throw new Error(`Failed to fetch inventory counts: ${text}`);
    }

    const inventoryData = await inventoryRes.json();
    const countMap = {};
    (inventoryData.counts || []).forEach(count => {
      const { catalog_object_id, quantity, location_id } = count;
      if (!countMap[catalog_object_id]) countMap[catalog_object_id] = {};
      countMap[catalog_object_id][location_id] = parseInt(quantity, 10);
    });

    inventoryItems.forEach(item => {
      item.variations.forEach(variation => {
        variation.current_count = countMap[variation.variation_id] || {};
      });
    });

    for (const item of inventoryItems) {
      let totalQuantity = 0;
      item.variations.forEach(variation => {
        for (const qty of Object.values(variation.current_count || {})) {
          totalQuantity += parseInt(qty, 10);
        }
      });

      const firstVariation = item.variations[0];
      const unitCost = firstVariation ? firstVariation.price : 0;
      const unit = firstVariation ? firstVariation.name : '';

      await Item.upsert({
        itemId: parseInt(item.item_id.replace(/\D/g, '').slice(0, 9)) || Math.floor(Math.random() * 1e6),
        itemName: item.name || 'Unnamed',
        unitCost: unitCost || 0,
        vendor: '',
        sku: null,
        expirationDate: null,
        unit: unit || 'unit',
        quantityInStock: totalQuantity || 0,
        isPerishable: 'N',
        businessId: businessId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    }

    console.log(`✅ Synced ${inventoryItems.length} items from Square to DB.`);
  } catch (error) {
    console.error('❌ Error syncing inventory:', error);
    throw error;
  }
}

// Route to trigger sync
router.post('/sync', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const business = await Business.findByPk(businessId);
    if (!business || !business.squareAccessToken) {
      return res.status(400).json({ error: 'Business not connected to Square' });
    }

    await syncSquareInventoryToDB(business.squareAccessToken, business.id);
    res.json({ message: 'Inventory synced successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// Get all items for the authenticated user's business
router.get('/items', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: businessId missing from token' });
    }

    const items = await Item.findAll({
      where: { businessId }
    });

    res.json(items);
  } catch (error) {
    console.error('❌ Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});


module.exports = { item: router };
