const express = require('express');
const router = express.Router();
const { Recipe, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

// Get all ingredients for the authenticated user's business
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: businessId missing from token' });
    }

    const items = await Inventory.findAll({
      where: { businessId }
    });

    res.json(items);
  } catch (error) {
    console.error('❌ Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST add new ingredient
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { itemId, unit, quantityInStock, threshold } = req.body;

    if (!itemId || !unit) {
      return res.status(400).json({ error: 'Missing required fields: itemId and unit' });
    }

    const inventory = await Inventory.create({
      businessId,
      itemId,
      unit,
      quantityInStock: quantityInStock,
      threshold: threshold,
    });

    res.status(201).json(inventory);
  } catch (err) {
    console.error('Error creating inventory:', err);
    res.status(500).json({ error: 'Failed to create inventory' });
  }
});

// PUT /:id - Update an existing inventory entry
router.put('/:id', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    const { itemId, unit, quantityInStock, threshold } = req.body;

    const inventory = await Inventory.findOne({
      where: {
        id,
        businessId,
      },
    });

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory entry not found' });
    }

    await inventory.update({
      itemId: itemId !== undefined ? itemId : inventory.itemId,
      unit: unit !== undefined ? unit : inventory.unit,
      quantityInStock: quantityInStock !== undefined ? quantityInStock : inventory.quantityInStock,
      threshold: threshold !== undefined ? threshold : inventory.threshold,
    });

    res.json(inventory);
  } catch (err) {
    console.error('Error updating inventory:', err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// DELETE item
router.delete('/:itemId', authenticateJWT, async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await Recipe.findOne({
      where: {
        itemId,
        businessId: req.user.businessId,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await item.destroy();
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('DELETE /items/:itemId error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = { ingredients: router };