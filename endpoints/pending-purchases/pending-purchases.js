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

// Update a pending purchase's status and total price
router.put('/:id/complete', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const { totalPrice } = req.body;
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from user token' });
  }

  try {
    const purchase = await PendingPurchase.findOne({ where: { id, businessId } });
    if (!purchase) {
      return res.status(404).json({ error: 'Pending purchase not found' });
    }
    await purchase.update({ status: 'completed', totalPrice });
    res.json({ message: 'Pending purchase marked as completed', data: purchase });
  } catch (error) {
    console.error('Error updating pending purchase:', error);
    res.status(500).json({ error: 'Failed to update pending purchase' });
  }
});

// Endpoint to get the difference between initial and confirmed pending purchase quantities and add the difference to the business's base shopping list
router.post('/:id/diff-to-shopping-list', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const businessId = req.user.businessId;
  const { confirmedQuantities } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from user token' });
  }

  try {
    // Find the pending purchase (for initial quantities)
    const purchase = await PendingPurchase.findOne({ where: { id, businessId } });
    if (!purchase) {
      return res.status(404).json({ error: 'Pending purchase not found' });
    }
    if (purchase.status !== 'completed') {
      return res.status(400).json({ error: 'Purchase must be completed to compare quantities' });
    }

    const initialQuantities = purchase.quantities;
    const itemIds = purchase.itemIds;

    if (!initialQuantities || !confirmedQuantities || !itemIds || initialQuantities.length !== confirmedQuantities.length) {
      return res.status(400).json({ error: 'Missing or mismatched quantities for diff calculation' });
    }

    // Calculate the difference for each item
    const diffItemIds = [];
    const diffQuantities = [];
    itemIds.forEach((itemId, idx) => {
      const diff = initialQuantities[idx] - confirmedQuantities[idx];
      if (diff > 0) { // Only add positive differences
        diffItemIds.push(itemId);
        diffQuantities.push(diff);
      }
    });

    // Update the pending purchase with the confirmed quantities
    await purchase.update({ quantities: confirmedQuantities });

    // Use the ShoppingList PUT endpoint logic to add/update items
    const { ShoppingList } = require('../../models');
    let shoppingList = await ShoppingList.findOne({ where: { businessId } });
    if (!shoppingList) {
      shoppingList = await ShoppingList.create({
        businessId,
        itemIds: diffItemIds,
        quantities: diffQuantities,
      });
    } else {
      // Update existing quantities or add new ones
      const updatedItemIds = [...shoppingList.itemIds];
      const updatedQuantities = [...shoppingList.quantities];
      diffItemIds.forEach((itemId, idx) => {
        const diffQty = diffQuantities[idx];
        const existingIdx = updatedItemIds.indexOf(itemId);
        if (existingIdx !== -1) {
          updatedQuantities[existingIdx] += diffQty;
        } else {
          updatedItemIds.push(itemId);
          updatedQuantities.push(diffQty);
        }
      });
      await shoppingList.update({ itemIds: updatedItemIds, quantities: updatedQuantities });
    }

    res.json({ message: 'Differences added to shopping list', itemIds: diffItemIds, quantities: diffQuantities });
  } catch (error) {
    console.error('Error diffing and updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list with differences' });
  }
});

// Endpoint to update inventory counts for a business based on itemIds and quantities from the dialog box
router.post('/:id/update-inventory', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const businessId = req.user.businessId;
  const { itemIds, quantities } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from user token' });
  }
  if (!itemIds || !quantities || itemIds.length !== quantities.length) {
    return res.status(400).json({ error: 'Invalid itemIds or quantities' });
  }

  try {
    const { Inventory } = require('../../models');
    // For each item, update the inventory count for this business
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const quantity = quantities[i];
      // Find the inventory record for this business and item
      const inventory = await Inventory.findOne({ where: { id: itemId, businessId } });
      if (inventory) {
        // Add the purchased quantity to the inventory
        await inventory.update({ quantityInStock: (inventory.quantityInStock || 0) + quantity });
      }
    }
    res.json({ message: 'Inventory updated successfully' });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

//  This is for a pull request test...

router.delete('/:id/update-pending-purchases', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const businessId = req.user.businessId;

  try {
    const purchase = await PendingPurchase.findOne({ where: { id, businessId } });
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    await purchase.destroy();
    res.json({ message: 'Purchase deleted successfully' });
  } catch (err) {
    console.error('Error deleting purchase:', err);
    res.status(500).json({ error: 'Failed to delete purchase' });
  }
});

module.exports = { pendingPurchases: router };