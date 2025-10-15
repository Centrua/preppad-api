const express = require('express');
const router = express.Router();
const { Recipe, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

router.get('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    const inventories = await Inventory.findAll({
      where: { businessId },
      attributes: ['id', 'itemName'],
      raw: true,
    });

    const inventoryMap = {};
    inventories.forEach(inv => {
      inventoryMap[inv.id] = { itemName: inv.itemName };
    });

    const items = await Recipe.findAll({
      where: { businessId },
      attributes: ['itemId', 'itemName', 'unitCost', 'ingredients', 'ingredientsQuantity', 'ingredientsUnit', 'categories', 'variations', 'modifiers'],
    });

    const recipes = items.map((item) => {
      const ingredients = (item.ingredients || []).map((ingredientId, idx) => {
        return {
          title: inventoryMap[ingredientId]?.itemName || 'Unknown',
          unit: (item.ingredientsUnit && item.ingredientsUnit[idx]) || '',
          quantity: item.ingredientsQuantity?.[idx] || '',
        };
      });
      // Deserialize modifiers if present and JSON-encoded
      let modifiers = [];
      if (item.modifiers) {
        try {
          if (typeof item.modifiers === 'string') {
            modifiers = JSON.parse(item.modifiers);
          } else if (Array.isArray(item.modifiers)) {
            modifiers = item.modifiers;
          }
        } catch (e) {
          console.error('Failed to parse modifiers for recipe', item.itemId, e);
          modifiers = [];
        }
      }
      return {
        id: item.itemId,
        title: item.itemName,
        unitCost: item.unitCost,
        ingredients,
        categories: item.categories || [],
        variations: item.variations || [],
        modifiers,
      };
    });

    res.json(recipes);
  } catch (err) {
    console.error('Error fetching recipes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { itemName, unitCost, ingredients, ingredientsQuantity, ingredientsUnit, categories, variations, modifiers } = req.body;

  if (!businessId || !itemName || !ingredients || !ingredientsUnit) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Recipe.create({
      businessId,
      itemName,
      unitCost,
      ingredients,
      ingredientsQuantity,
      ingredientsUnit,
      categories: categories || [],
      variations: variations || [],
      modifiers: modifiers || [],
    });

    res.status(201).json({
      id: item.itemId,
      itemName: item.itemName,
      unitCost: item.unitCost,
      ingredients: item.ingredients,
      ingredientsQuantity: item.ingredientsQuantity,
      categories: item.categories || [],
      variations: item.variations || [],
      modifiers: item.modifiers || [],
    });
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { id } = req.params;
  const updateFields = req.body;

  if (!businessId || !id) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Recipe.findOne({
      where: { itemId: id, businessId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        item[key] = updateFields[key];
      }
    });

    await item.save();

  res.json(item);
  } catch (err) {
    console.error('Error updating recipe:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { id } = req.params;

  try {
    const item = await Recipe.findOne({
      where: { itemId: id, businessId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    await item.destroy();
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    console.error('Error deleting recipe:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { recipes: router };