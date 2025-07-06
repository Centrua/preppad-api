const express = require('express');
const router = express.Router();
const { Recipe, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');
const { Op } = require('sequelize');

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
    const { itemName, allowedUnits, baseUnit, quantityInStock, max, conversionRate } = req.body;

    if (!itemName || !allowedUnits || !Array.isArray(allowedUnits) || allowedUnits.length === 0) {
      return res.status(400).json({ error: 'Missing required field: itemName or allowedUnits' });
    }

    const inventory = await Inventory.create({
      itemName: itemName || null,
      businessId,
      allowedUnits,
      baseUnit,
      quantityInStock: quantityInStock,
      max: max,
      conversionRate: conversionRate !== undefined ? conversionRate : null,
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
    const { allowedUnits, baseUnit, quantityInStock, max, conversionRate } = req.body;

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
      allowedUnits: allowedUnits !== undefined ? allowedUnits : inventory.allowedUnits,
      baseUnit: baseUnit !== undefined ? baseUnit : inventory.baseUnit,
      quantityInStock: quantityInStock !== undefined ? quantityInStock : inventory.quantityInStock,
      max: max !== undefined ? max : inventory.max,
      conversionRate: conversionRate !== undefined ? conversionRate : inventory.conversionRate,
    });

    res.json(inventory);
  } catch (err) {
    console.error('Error updating inventory:', err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// DELETE item
router.delete('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    // Check if this ingredient is used in any recipe
    const recipesUsingIngredient = await Recipe.findOne({
      where: {
        businessId,
        ingredients: { [Op.contains]: [parseInt(id)] },
      },
    });

    if (recipesUsingIngredient) {
      return res.status(409).json({
        error: 'This ingredient is used in one or more recipes. Please remove it from all recipes before deleting.',
      });
    }

    const item = await Inventory.findOne({
      where: {
        id,
        businessId,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await item.destroy();
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('DELETE /ingredients/:id error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = { ingredients: router };