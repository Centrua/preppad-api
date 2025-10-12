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
router.post('/:id/shopping-list', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { note, quantity } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from user token' });
  }

  try {
    const { id } = req.params;

    const inventoryItem = await Inventory.findOne({
      where: { id, businessId },
    });

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    let shoppingList = await ShoppingList.findOne({ where: { businessId } });

    if (!shoppingList) {
      shoppingList = await ShoppingList.create({
        businessId,
        itemIds: [],
        quantities: [],
        notes: [],
      });
    }

    const numericId = Number(id);
    const existingIdx = shoppingList.itemIds.findIndex((itemId) => itemId === numericId);
    const updatedItemIds = [...shoppingList.itemIds];
    const updatedQuantities = [...shoppingList.quantities];
    const updatedNotes = shoppingList.notes ? [...shoppingList.notes] : [];
    console.log("Shopping List: ", shoppingList);

    if (existingIdx !== -1) {
      updatedQuantities[existingIdx] += quantity;
      if (!updatedNotes[existingIdx]) { // Only overwrite if no existing note
        updatedNotes[existingIdx] = note;
      }
    } else {
      updatedItemIds.push(numericId);
      updatedQuantities.push(quantity);
      updatedNotes.push(note);
    }

    await shoppingList.update({
      itemIds: updatedItemIds,
      quantities: updatedQuantities,
      notes: updatedNotes,
    });

    res.json({
      message: 'Item added to shopping list with note',
      shoppingList,
    });
  } catch (error) {
    console.error('Error adding item to shopping list:', error);
    res.status(500).json({ error: 'Failed to add item to shopping list' });
  }
});

// DELETE a specific quantity of an item from the base shopping list
router.delete('/:itemId', authenticateJWT, async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ error: 'A valid quantity is required' });
  }

  try {
    const shoppingList = await ShoppingList.findOne({ where: { businessId } });

    if (!shoppingList) {
      return res.status(404).json({ error: 'Shopping list not found' });
    }

    // Reduce the quantity or remove the item if quantity becomes zero or less
    const numericId = Number(itemId);
    const updatedItemIds = [...shoppingList.itemIds];
    const updatedQuantities = [...shoppingList.quantities];
    const existingIdx = updatedItemIds.findIndex(itemId => Number(itemId) === numericId);

    if (existingIdx === -1) {
      return res.status(404).json({ error: 'Item not found in shopping list' });
    }

    updatedQuantities[existingIdx] -= quantity;
    if (updatedQuantities[existingIdx] <= 0) {
      updatedItemIds.splice(existingIdx, 1);
      updatedQuantities.splice(existingIdx, 1);
    }

    await shoppingList.update({
      itemIds: updatedItemIds,
      quantities: updatedQuantities,
    });

    res.json({
      message: 'Quantity updated or item removed from shopping list',
      items: updatedItemIds,
      quantities: updatedQuantities,
    });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});

module.exports = { shoppingList: router };
