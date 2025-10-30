const express = require('express');
const router = express.Router();
const { ShoppingList, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

async function getOrCreateShoppingList(businessId) {
  let shoppingList = await ShoppingList.findOne({ where: { businessId } });
  if (!shoppingList) {
    shoppingList = await ShoppingList.create({
      businessId,
      itemIds: [],
      quantities: [],
      notes: [],
    });
  }
  return shoppingList;
}

function updateShoppingListItems(shoppingList, itemId, quantity, note) {
  const numericId = Number(itemId);
  const updatedItemIds = [...shoppingList.itemIds];
  const updatedQuantities = [...shoppingList.quantities];
  const updatedNotes = shoppingList.notes ? [...shoppingList.notes] : [];
  const existingIdx = updatedItemIds.findIndex((id) => Number(id) === numericId);
  if (existingIdx !== -1) {
    if (quantity !== 0 && typeof quantity === 'number') {
      updatedQuantities[existingIdx] += quantity;
    }
    if (!updatedNotes[existingIdx]) {
      updatedNotes[existingIdx] = note;
    }
  } else {
    updatedItemIds.push(numericId);
    updatedQuantities.push(quantity);
    updatedNotes.push(note);
  }
  return { itemIds: updatedItemIds, quantities: updatedQuantities, notes: updatedNotes };
}

function removeItemFromShoppingList(shoppingList, itemId, quantity) {
  const numericId = Number(itemId);
  const updatedItemIds = [...shoppingList.itemIds];
  const updatedQuantities = [...shoppingList.quantities];
  const updatedNotes = shoppingList.notes ? [...shoppingList.notes] : [];
  const existingIdx = updatedItemIds.findIndex(id => Number(id) === numericId);
  if (existingIdx === -1) {
    return null;
  }
  updatedQuantities[existingIdx] -= quantity;
  if (updatedQuantities[existingIdx] <= 0) {
    updatedItemIds.splice(existingIdx, 1);
    updatedQuantities.splice(existingIdx, 1);
    updatedNotes.splice(existingIdx, 1);
  }
  return { itemIds: updatedItemIds, quantities: updatedQuantities, notes: updatedNotes };
}

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

    const items = await Inventory.findAll({
      where: {
        id: itemIds,
      },
      attributes: ['id', 'itemName'],
    });

    const itemNameMap = {};
    items.forEach(item => {
      itemNameMap[item.id] = item.itemName;
    });

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

router.put('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { itemIds, quantities } = req.body;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    let shoppingList = await getOrCreateShoppingList(businessId);
    itemIds.forEach((itemId, idx) => {
      const quantity = quantities[idx];
      const merged = updateShoppingListItems(shoppingList, itemId, quantity, null);
      shoppingList.itemIds = merged.itemIds;
      shoppingList.quantities = merged.quantities;
      shoppingList.notes = merged.notes;
    });
    await shoppingList.update({
      itemIds: shoppingList.itemIds,
      quantities: shoppingList.quantities,
      notes: shoppingList.notes,
    });
    res.json({ message: 'Shopping list updated successfully', shoppingList });
  } catch (err) {
    console.error('Error updating shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

    let shoppingList = await getOrCreateShoppingList(businessId);
    const merged = updateShoppingListItems(shoppingList, id, quantity, note);
    await shoppingList.update({
      itemIds: merged.itemIds,
      quantities: merged.quantities,
      notes: merged.notes,
    });
    res.json({
      message: 'Item added to shopping list with note',
      shoppingList: {
        ...shoppingList.toJSON(),
        itemIds: merged.itemIds,
        quantities: merged.quantities,
        notes: merged.notes,
      },
    });
  } catch (error) {
    console.error('Error adding item to shopping list:', error);
    res.status(500).json({ error: 'Failed to add item to shopping list' });
  }
});

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
    let shoppingList = await getOrCreateShoppingList(businessId);
    const merged = removeItemFromShoppingList(shoppingList, itemId, quantity);
    if (!merged) {
      return res.status(404).json({ error: 'Item not found in shopping list' });
    }
    await shoppingList.update({
      itemIds: merged.itemIds,
      quantities: merged.quantities,
      notes: merged.notes,
    });
    res.json({
      message: 'Quantity updated or item removed from shopping list',
      items: merged.itemIds,
      quantities: merged.quantities,
    });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({ error: 'Failed to update shopping list' });
  }
});

module.exports = { shoppingList: router };
