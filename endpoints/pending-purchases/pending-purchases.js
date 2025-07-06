const express = require('express');
const router = express.Router();
const { Recipe, PendingPurchase } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

router.get('/', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID missing from user token' });
    }

    // Step 1: Get all pending purchases
    const purchases = await PendingPurchase.findAll({
      where: { businessId },
    });

    // Step 2: Collect all unique item IDs from all purchases
    const allItemIds = Array.from(
      new Set(purchases.flatMap(purchase => purchase.itemIds))
    );

    // Step 3: Fetch the items for those IDs from Inventory
    const Inventory = require('../../models').Inventory;
    const items = await Inventory.findAll({
      where: { id: allItemIds },
      attributes: ['id', 'itemName'],
    });

    // Create a lookup map id -> itemName
    const itemMap = items.reduce((acc, item) => {
      acc[item.id] = item.itemName;
      return acc;
    }, {});

    // Step 4: Map item names back onto each purchase
    const result = purchases.map(purchase => {
      const itemNames = purchase.itemIds.map(id => itemMap[id] || 'Unknown Item');
      return {
        ...purchase.toJSON(),
        itemNames,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching pending purchases:', err);
    res.status(500).json({ error: 'Failed to fetch pending purchases' });
  }
});

// Create a new Pending Purchase
router.post('/', authenticateJWT, async (req, res) => {
  const { itemIds, quantities, cheapestUnitPrice, vendor, totalPrice } = req.body;
  const businessId = req.user.businessId; // Get businessId from JWT user info

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from user token' });
  }

  if (!itemIds || !quantities || itemIds.length !== quantities.length) {
    return res.status(400).json({ error: 'Invalid item data or mismatched itemIds and quantities' });
  }

  try {
    const newPurchase = await PendingPurchase.create({
      businessId,
      itemIds,
      quantities,
      cheapestUnitPrice,
      vendor,
      totalPrice,
    });
    res.status(201).json({ message: 'Pending purchase created', data: newPurchase });
  } catch (error) {
    console.error('Error creating pending purchase:', error);
    res.status(500).json({ error: 'Failed to create pending purchase' });
  }
});

module.exports = { pendingPurchases: router };