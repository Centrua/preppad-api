const express = require('express');
const router = express.Router();
const { Recipe, Business, ProcessedEvent, ShoppingList, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');
const db = require('../../models');

const CATALOG_URL = `${process.env.SQUARE_URL}/v2/catalog/list?types=ITEM`;
const CATALOG_MODIFIER_URL = `${process.env.SQUARE_URL}/v2/catalog/list?types=MODIFIER`;
const INVENTORY_URL = `${process.env.SQUARE_URL}/v2/inventory/batch-retrieve-counts`;

function convertToBaseUnit(amount, fromUnit, toUnit, conversionRate = null) {
  if (toUnit === 'Count') {
    if (fromUnit !== 'Count') throw new Error('Invalid conversion: fromUnit must be Count if toUnit is Count');
    if (conversionRate && conversionRate > 0) {
      return amount / conversionRate;
    }
    return amount;
  }

  if (toUnit === 'Ounce') {
    const toOunces = {
      'Teaspoons': 1 / 6,        // 6 tsp = 1 oz
      'Tablespoons': 1 / 2,      // 2 tbsp = 1 oz
      'Fluid Ounces': 1,         // 1 fl oz = 1 oz
      'Dry Ounces': 1,           // 1 dry oz = 1 oz
      'Cups': 8,                 // 1 cup = 8 oz
      'Pints': 16,               // 1 pint = 16 oz
      'Quarts': 32,              // 1 quart = 32 oz
      'Gallons': 128,            // 1 gallon = 128 oz
      'Ounce': 1,                // already ounces
      'Milliliters': 0.033814,   // 1 ml = 0.033814 oz (US fluid)
      'Liters': 33.814,          // 1 l = 33.814 oz (US fluid)
      'Grams': 0.035274,         // 1 g = 0.035274 oz (weight)
      'Kilograms': 35.274,       // 1 kg = 35.274 oz (weight)
      'Milligrams': 0.000035274, // 1 mg = 0.000035274 oz (weight)
      'Pounds': 16,              // 1 lb = 16 oz (weight)
    };
    if (!toOunces[fromUnit]) throw new Error(`Invalid fromUnit for ounce conversion: ${fromUnit}`);
    let ounces = amount * toOunces[fromUnit];
    if (conversionRate && conversionRate > 0) {
      return ounces / conversionRate;
    }
    return ounces;
  }
}

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
      const { name, modifier_list_info, variations = [] } = item_data;

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
        modifier_list_info,
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

      let variationIds = [];
      for (const variation of item.variations) {
        // Always create a new recipe for this variation
        const variationRecipe = await Recipe.create({
          itemName: variation.name,
          unitCost: variation.price || 0,
          quantityInStock: Object.values(variation.current_count || {}).reduce((a, b) => a + b, 0),
          businessId: businessId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Find the recipe for this item
        const parentRecipe = await Recipe.findOne({
          where: {
            itemName: item.name,
            businessId: businessId,
          },
        });
        let foundDuplicate = false;
        if (parentRecipe && Array.isArray(parentRecipe.variations)) {
          // Get all recipes referenced in the variations array
          const allRecipes = await Recipe.findAll({ where: { businessId: businessId } });
          for (const variationId of parentRecipe.variations) {
            const vRecipe = allRecipes.find(r => r.itemId === variationId);
            if (vRecipe && vRecipe.itemName === variationRecipe.itemName && vRecipe.itemId !== variationRecipe.itemId) {
              foundDuplicate = true;
              break;
            }
          }
        }
        console.log('Parent recipe variations before:', parentRecipe ? parentRecipe.variations : null);
        if (foundDuplicate) {
          await variationRecipe.destroy();
          console.log(`Deleted duplicate variation recipe: ${variationRecipe.itemName}`);
        } else {
          // Add the new variationRecipe.itemId to the parent recipe's variations array if not already present
          if (parentRecipe) {
            if (!Array.isArray(parentRecipe.variations)) parentRecipe.variations = [];
            if (!parentRecipe.variations.includes(variationRecipe.itemId)) {
              parentRecipe.variations.push(variationRecipe.itemId);
              await parentRecipe.save();
              console.log(`Added variationRecipe.itemId ${variationRecipe.itemId} to parent recipe ${parentRecipe.itemId}`);
            } else {
              console.log(`variationRecipe.itemId ${variationRecipe.itemId} already present in parent recipe ${parentRecipe.itemId}`);
            }
            console.log('Parent recipe variations after:', parentRecipe.variations);
          } else {
            console.log('No parent recipe found for item:', item.name);
          }
          variationIds.push(variationRecipe.itemId);
        }
        console.log(`Created variation recipe: ${variationRecipe.itemName}`);
      }

      let modifiersArr = [];
      if(item.modifier_list_info && item.modifier_list_info.length > 0) {
        for (const modListInfo of item.modifier_list_info) {
          if(!modListInfo.modifier_overrides) continue;
          for (const override of modListInfo.modifier_overrides) {
            modifiersArr.push(override.modifier_id);
          }
        }
      }

      let modifierObjectsArr = [];
      if (modifiersArr.length > 0) {
        const modifierRes = await fetch(CATALOG_MODIFIER_URL, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (modifierRes.ok) {
          const modifierData = await modifierRes.json();
          const modifierObjects = modifierData.objects || [];
          const modifierIdToName = {};
          for (const obj of modifierObjects) {
            if (obj.type === 'MODIFIER' && obj.id && obj.modifier_data && obj.modifier_data.name) {
              modifierIdToName[obj.id] = obj.modifier_data.name;
            }
          }
          for (const modId of modifiersArr) {
            const name = modifierIdToName[modId] || modId;
            const ingredient = await Inventory.findOne({ where: { itemName: name, businessId } });
            if (ingredient) {
              modifierObjectsArr.push({ name, ingredientId: ingredient.id, quantity: 1 });
            } else {
              modifierObjectsArr.push({ name, ingredientId: null, quantity: 1 });
              console.warn(`Modifier ingredient not found for name: ${name}`);
            }
          }
        } else {
          console.error('Failed to fetch modifier names from catalog');
        }
      } else {
        console.warn('No modifiers found for this item.');
      }
      let existingRecipe = await Recipe.findOne({
        where: {
          itemName: item.name || 'Unnamed',
          businessId: businessId,
        },
      });
      if (!existingRecipe) {
        await Recipe.create({
          itemName: item.name || 'Unnamed',
          unitCost: unitCost || 0,
          quantityInStock: totalQuantity || 0,
          businessId: businessId,
          variations: variationIds,
          modifiers: modifierObjectsArr,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } else {
        let currentModifiers = Array.isArray(existingRecipe.modifiers) ? existingRecipe.modifiers.map(m => {
          if (typeof m === 'string') {
            try {
              return JSON.parse(m);
            } catch (e) {
              console.warn('Failed to parse modifier JSON:', m);
              return null;
            }
          }
          return m;
        }).filter(Boolean) : [];
        let updatedModifiers = [...currentModifiers];
        for (const modObj of modifierObjectsArr) {
          if (!updatedModifiers.some(m => m.name === modObj.name)) {
            updatedModifiers.push(modObj);
          } else {
          }
        }
        let currentVariations = Array.isArray(existingRecipe.variations) ? existingRecipe.variations : [];
        let updatedVariations = [...currentVariations];
        for (const variationId of variationIds) {
          if (!updatedVariations.includes(variationId)) {
            updatedVariations.push(variationId);
          } else {
          }
        }
        await existingRecipe.update({
          modifiers: updatedModifiers,
          variations: updatedVariations,
        });
      }
    }

    console.log(`Synced ${inventoryItems.length} items from Square to DB.`);
  } catch (error) {
    console.error('Error syncing inventory:', error);
    throw error;
  }
}

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

async function getOrder(orderId, accessToken) {
  const response = await fetch(`${process.env.SQUARE_URL}/v2/orders/${orderId}`, {
    method: 'GET',
    headers:
     {
      'Square-Version': '2023-06-08',
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Square API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.order;
}

router.post('/webhook/order-updated', express.json(), async (req, res) => {
  const event = req.body;

  res.status(200).send('OK');

  const orderUpdated = event.data?.object?.order_updated;

  if (!event || event.type !== 'order.updated' || !orderUpdated?.order_id) {
    console.error('Invalid payload received');
    return;
  }

  const orderId = orderUpdated.order_id;
  const merchantId = event.merchant_id;

  try {
    const business = await Business.findOne({ where: { squareMerchantId: merchantId } });
    if (!business || !business.squareAccessToken) {
      console.error('Business not found or missing access token');
      return;
    }

    const existing = await ProcessedEvent.findByPk(orderId);
    if (existing) {
      console.log('Duplicate webhook ignored:', orderId);
      return;
    }

    await ProcessedEvent.create({ orderId });
    const fullOrder = await getOrder(orderId, business.squareAccessToken);
    const businessId = business.id;

    for (const item of fullOrder.line_items || []) {
      const itemName = item.name;
      let dbItem = await Recipe.findOne({
        where: {
          itemName: itemName,
          businessId: businessId,
        },
      });

      const processedIngredientIds = new Set();

      if (Array.isArray(item.modifiers) && item.modifiers.length > 0 && dbItem && Array.isArray(dbItem.modifiers)) {
        for (const orderModifier of item.modifiers) {
          const recipeModifier = dbItem.modifiers.find(m => m.name === orderModifier.name);
          if (recipeModifier) {
            const ingredientId = recipeModifier.ingredientId;
            processedIngredientIds.add(ingredientId);
            const ingredientQuantity = Number(recipeModifier.quantity) || 1;
            const ingredient = await Inventory.findOne({
              where: {
                id: ingredientId,
                businessId: businessId,
              },
            });
            if (!ingredient) {
              console.warn(`Modifier ingredient not found in DB for business ${businessId}: ${ingredientId}`);
              continue;
            }
            const modifierUnit = ingredient.baseUnit || 'Count';
            const baseUnit = ingredient.baseUnit || ingredient.unit || 'Count';
            const conversionRate = ingredient.conversionRate || null;
            const fromUnit = recipeModifier.unit || modifierUnit;
            const ingredientQtyUsed = convertToBaseUnit(
              ingredientQuantity,
              fromUnit,
              baseUnit,
              ingredient.itemName || '',
              conversionRate
            );
            const newQuantity = ingredient.quantityInStock - ingredientQtyUsed;
            await ingredient.update({ quantityInStock: newQuantity });
            if (newQuantity <= ingredient.max / 2) {
              const idx = currentItemIds.indexOf(ingredient.id);
              const needed = ingredient.max - newQuantity;
              if (idx === -1) {
                if (needed > 0) {
                  currentItemIds.push(ingredient.id);
                  currentQuantities.push(Math.ceil(needed));
                }
              } else {
                if (currentQuantities[idx] >= ingredient.max) {
                  currentQuantities[idx] += Math.ceil(ingredientQtyUsed);
                } else {
                  if (needed > 0) {
                    currentQuantities[idx] = Math.ceil(needed);
                  }
                }
              }
            }
          }
        }
      }

      if (item.variation_name) {
        const allRecipes = await Recipe.findAll({ where: { businessId } });
        for (const recipe of allRecipes) {
          if (Array.isArray(recipe.variations) && recipe.variations.length > 0) {
            for (const variationId of recipe.variations) {
              const variationRecipe = allRecipes.find(r => r.itemId === variationId);
              if (variationRecipe) {
              }
              if (variationRecipe && variationRecipe.itemName === item.variation_name) {
                dbItem = recipe;
                if (!recipe.variations.includes(variationRecipe.itemId)) {
                  recipe.variations.push(variationRecipe.itemId);
                  await recipe.update({ variations: recipe.variations });
                }
                break;
              }
            }
          }
        }
      }

      if (!dbItem) {
        console.warn(`Item not found in DB for business ${businessId}: ${itemName}`);
        continue;
      }

      let shoppingList = await ShoppingList.findOne({ where: { businessId } });
      if (!shoppingList) {
        shoppingList = await ShoppingList.create({
          businessId,
          itemIds: [],
          quantities: [],
        });
      }

      let currentItemIds = Array.isArray(shoppingList.itemIds) ? [...shoppingList.itemIds] : [];
      let currentQuantities = Array.isArray(shoppingList.quantities) ? [...shoppingList.quantities] : [];

      if (dbItem.ingredients && dbItem.ingredients.length > 0) {
        const itemQuantityOrdered = Number(item.quantity) || 1;
        for (let i = 0; i < dbItem.ingredients.length; i++) {
          const ingredientId = dbItem.ingredients[i];
          if (processedIngredientIds.has(ingredientId)) continue;
          const ingredientQtyUsedRaw = dbItem.ingredientsQuantity?.[i] || 0;
          const ingredient = await Inventory.findOne({
            where: {
              id: ingredientId,
              businessId: businessId,
            },
          });

          if (!ingredient) continue;

          const totalQtyUsedRaw = ingredientQtyUsedRaw * itemQuantityOrdered;

          const recipeUnit = dbItem.ingredientsUnit && dbItem.ingredientsUnit[i] ? dbItem.ingredientsUnit[i] : (ingredient.baseUnit || ingredient.unit);
          const baseUnit = ingredient.baseUnit || ingredient.unit;
          let ingredientQtyUsed = convertToBaseUnit(
            totalQtyUsedRaw,
            recipeUnit,
            baseUnit,
            ingredient.itemName || '',
            ingredient.conversionRate || null
          );

          const ingredientQtyUsedWhole = Math.ceil(ingredientQtyUsed);

          const newQuantity = ingredient.quantityInStock - ingredientQtyUsed;
          await ingredient.update({ quantityInStock: newQuantity });

          if (newQuantity <= ingredient.max / 2) {
            const idx = currentItemIds.indexOf(ingredientId);
            const needed = ingredient.max - newQuantity;
            if (idx === -1) {
              if (needed > 0) {
                currentItemIds.push(ingredientId);
                currentQuantities.push(Math.ceil(needed));
              }
            } else {
              if (currentQuantities[idx] >= ingredient.max) {
                currentQuantities[idx] += ingredientQtyUsedWhole;
              } else {
                if (needed > 0) {
                  currentQuantities[idx] = Math.ceil(needed);
                }
              }
            }
          }
        }
      }

      await shoppingList.update({
        itemIds: currentItemIds,
        quantities: currentQuantities,
      });
    }

    console.log('Order processed:', orderId);
  } catch (err) {
    console.error('Error processing Square order webhook:', err);
  }
});

module.exports = { order: router };