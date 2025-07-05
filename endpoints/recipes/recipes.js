const express = require('express');
const router = express.Router();
const { Recipe} = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

router.get('/', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    const items = await Recipe.findAll({
      where: { businessId },
      attributes: ['itemId', 'itemName', 'unitCost', 'ingredients', 'ingredientsQuantity', 'ingredientsUnit'],
    });

    const recipes = items.map((item) => {
      const ingredients = (item.ingredients || []).map((title, idx) => ({
        title,
        quantity: item.ingredientsQuantity?.[idx] || '',
        unit: item.ingredientsUnit?.[idx] || '',
      }));

      return {
        id: item.itemId,
        title: item.itemName,
        unitCost: item.unitCost,
        ingredients,
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
  const { title, unitCost, ingredients, ingredientsQuantity, ingredientsUnit } = req.body;

  if (!businessId || !title || !ingredients) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Recipe.create({
      businessId,
      itemName: title,
      unitCost,
      ingredients,
      ingredientsQuantity,
      ingredientsUnit,
      vendor: 'Recipe', // placeholder
      unit: 'N/A',      // placeholder
      quantityInStock: 0, // default
      isPerishable: 'N', // default
    });

    res.status(201).json({
      id: item.itemId,
      title: item.itemName,
      unitCost: item.unitCost,
      ingredients: item.ingredients,
      ingredientsQuantity: item.ingredientsQuantity,
      ingredientsUnit: item.ingredientsUnit,
    });
  } catch (err) {
    console.error('Error creating recipe:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { id } = req.params;
  const { title, unitCost, ingredients, ingredientsQuantity, ingredientsUnit } = req.body;

  if (!businessId || !id || !title || !ingredients) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Recipe.findOne({
      where: { itemId: id, businessId },
    });

    if (!item) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    item.itemName = title;
    item.unitCost = unitCost;
    item.ingredients = ingredients;
    item.ingredientsQuantity = ingredientsQuantity;
    item.ingredientsUnit = ingredientsUnit;

    await item.save();

    res.json({
      id: item.itemId,
      title: item.itemName,
      unitCost: item.unitCost,
      ingredients,
      ingredientsQuantity,
      ingredientsUnit,
    });
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