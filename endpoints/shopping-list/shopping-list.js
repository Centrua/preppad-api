const express = require('express');
const router = express.Router();
const { ShoppingList, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

// GET base shopping list for a business
router.get('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    const shoppingList = await ShoppingList.findOne({
      where: { businessId },
    });

    if (!shoppingList) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    const { itemIds } = shoppingList;

    // Fetch items from Inventory by their IDs
    const items = await Inventory.findAll({
      where: {
        id: itemIds,
      },
      attributes: ['id', 'itemName'],
    });

    // Map id → itemName
    const itemNameMap = {};
    items.forEach(item => {
      itemNameMap[item.id] = item.itemName;
    });

    // Preserve original order
    const itemNames = itemIds.map(id => itemNameMap[id] || 'Unknown');

    res.json({
      ...shoppingList.toJSON(),
      itemNames,
    });
  } catch (err) {
    console.error('Error fetching shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update shopping list (PUT)
router.put('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { itemIds, quantities } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    let shoppingList = await ShoppingList.findOne({ where: { businessId } });

    if (!shoppingList) {
      // Create new list if it doesn't exist
      shoppingList = await ShoppingList.create({
        businessId,
        itemIds,
        quantities,
      });
    } else {
      // Append to existing arrays
      const updatedList = {
        itemIds: [...shoppingList.itemIds, ...itemIds],
        quantities: [...shoppingList.quantities, ...quantities],
      };

      await shoppingList.update(updatedList);
    }

    res.json({ message: 'Shopping list updated successfully', shoppingList });
  } catch (err) {
    console.error('Error updating shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear shopping list (PUT /clear)
router.put('/clear', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    const shoppingList = await ShoppingList.findOne({ where: { businessId } });

    if (!shoppingList) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    await shoppingList.update({
      itemIds: [],
      quantities: [],
    });

    res.json({ message: 'Shopping list cleared successfully', shoppingList });
  } catch (err) {
    console.error('Error clearing shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /shopping-list/:id - update shopping list if item's quantity is less than max
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;

    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: missing businessId' });
    }

    const inventoryItem = await Inventory.findOne({
      where: { id, businessId }
    });

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    console.log(`🧾 Checking inventory item: ${inventoryItem.itemName}`);

    const quantityInStock = Number(inventoryItem.quantityInStock);
    const max = Number(inventoryItem.max);

    if (quantityInStock < max) {
      const neededQty = max - quantityInStock;

      let shoppingList = await ShoppingList.findOne({ where: { businessId } });

      if (!shoppingList) {
        shoppingList = await ShoppingList.create({
          businessId,
          itemIds: [],
          quantities: [],
        });
      }

      const itemIndex = shoppingList.itemIds.indexOf(Number(id));
      console.log(`🔍 itemIndex in shopping list: ${itemIndex}`);

      if (itemIndex !== -1) {
        shoppingList.quantities[itemIndex] = neededQty;
      } else {
        shoppingList.itemIds.push(Number(id));
        shoppingList.quantities.push(neededQty);
      }

      await shoppingList.save();
      console.log('🛒 Shopping list updated');
    } else {
      console.log('✅ Inventory is sufficient; no update to shopping list');
    }

    res.status(200).json({ message: 'Shopping list checked/updated successfully' });

  } catch (err) {
    console.error('❌ Error updating shopping list:', err);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});


module.exports = { shoppingList: router };
