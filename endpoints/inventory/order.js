const express = require('express');
const router = express.Router();
const { Recipe, Business, ProcessedEvent, ShoppingList, Inventory } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');

const CATALOG_URL = `https://${process.env.SQUARE_URL}/v2/catalog/list?types=ITEM`;
const INVENTORY_URL = `https://${process.env.SQUARE_URL}/v2/inventory/batch-retrieve-counts`;

// Add this helper function near the top of your file
function convertToBaseUnit(amount, fromUnit, toUnit, ingredientName = '', conversionRate = null) {
  // Conversion rates to "Teaspoons" as the smallest common denominator
  const toTeaspoons = {
    'Teaspoons': 1,
    'Tablespoons': 3,
    'Fluid Ounces': 6,
    'Cups': 48,
    'Pints': 96,
    'Quarts': 192,
    'Gallons': 768,
    'Dry Ounces': 6, // Approximate for water
    'Count': 1,
    'Slices': 1, // Default, but see below for special handling
    'Whole/Package': 20, // Default: 1 Whole/Package = 20 Slices
  };

  // Use conversionRate from DB if provided and converting between Slices and Whole/Package
  if (
    conversionRate &&
    ((fromUnit === 'Slices' && toUnit === 'Whole/Package') || (fromUnit === 'Whole/Package' && toUnit === 'Slices'))
  ) {
    if (fromUnit === 'Slices' && toUnit === 'Whole/Package') {
      return amount / conversionRate;
    }
    if (fromUnit === 'Whole/Package' && toUnit === 'Slices') {
      return amount * conversionRate;
    }
  }

  // Special case: Cheese - 16 slices = 1 Whole/Package
  if ((fromUnit === 'Slices' && toUnit === 'Whole/Package') && ingredientName && ingredientName.toLowerCase().includes('cheese')) {
    return amount / 16;
  }
  if ((fromUnit === 'Whole/Package' && toUnit === 'Slices') && ingredientName && ingredientName.toLowerCase().includes('cheese')) {
    return amount * 16;
  }

  // Special case: Bread - 20 slices = 1 Whole/Package
  if ((fromUnit === 'Slices' && toUnit === 'Whole/Package') && ingredientName && ingredientName.toLowerCase().includes('bread')) {
    return amount / 20;
  }
  if ((fromUnit === 'Whole/Package' && toUnit === 'Slices') && ingredientName && ingredientName.toLowerCase().includes('bread')) {
    return amount * 20;
  }

  // General case: 20 slices = 1 Whole/Package
  if ((fromUnit === 'Slices' && toUnit === 'Whole/Package')) {
    return amount / 20;
  }
  if ((fromUnit === 'Whole/Package' && toUnit === 'Slices')) {
    return amount * 20;
  }

  if (fromUnit === toUnit) return amount;

  // If either unit is not in the table, return as-is
  if (!toTeaspoons[fromUnit] || !toTeaspoons[toUnit]) return amount;

  // Convert from fromUnit to teaspoons, then to toUnit
  const amountInTeaspoons = amount * toTeaspoons[fromUnit];
  return amountInTeaspoons / toTeaspoons[toUnit];
}

// Main sync function
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
      const { name, description, variations = [] } = item_data;

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
        description,
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

      await Recipe.upsert({
        itemName: item.name || 'Unnamed',
        unitCost: unitCost || 0,
        quantityInStock: totalQuantity || 0,
        businessId: businessId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    }

    console.log(`✅ Synced ${inventoryItems.length} items from Square to DB.`);
  } catch (error) {
    console.error('❌ Error syncing inventory:', error);
    throw error;
  }
}

// Route to trigger sync
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

// Updated getOrder to take the token
async function getOrder(orderId, accessToken) {
  const response = await fetch(`https://${process.env.SQUARE_URL}/v2/orders/${orderId}`, {
    method: 'GET',
    headers: {
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

// Webhook handler
router.post('/webhook/order-updated', express.json(), async (req, res) => {
  const event = req.body;

  // Send a 200 response to Square immediately
  res.status(200).send('OK');

  const orderUpdated = event.data?.object?.order_updated;

  if (!event || event.type !== 'order.updated' || !orderUpdated?.order_id) {
    console.error('Invalid payload received');
    return; // Exit early since response is already sent
  }

  const orderId = orderUpdated.order_id;
  const merchantId = event.merchant_id;

  try {
    // Lookup business by Square merchant ID
    const business = await Business.findOne({ where: { squareMerchantId: merchantId } });
    if (!business || !business.squareAccessToken) {
      console.error('Business not found or missing access token');
      return;
    }

    // Skip if already processed
    const existing = await ProcessedEvent.findByPk(orderId);
    if (existing) {
      console.log('Duplicate webhook ignored:', orderId);
      return;
    }

    // Process the order (your logic here)
    console.log('Processing order:', orderId);
    // Mark order as processed
    await ProcessedEvent.create({ orderId });
    const fullOrder = await getOrder(orderId, business.squareAccessToken);
    // Mark order as processed
    const businessId = business.id;

    for (const item of fullOrder.line_items || []) {
      const itemName = item.name;

      // Find item in your DB by name and businessId
      const dbItem = await Recipe.findOne({
        where: {
          itemName: itemName,
          businessId: businessId,
        },
      });

      if (!dbItem) {
        console.warn(`Item not found in DB for business ${businessId}: ${itemName}`);
        continue;
      }

      // Get or create the shopping list for this business
      let shoppingList = await ShoppingList.findOne({ where: { businessId } });
      if (!shoppingList) {
        shoppingList = await ShoppingList.create({
          businessId,
          itemIds: [],
          quantities: [],
        });
      }

      // Convert to mutable arrays for easier updates
      let currentItemIds = Array.isArray(shoppingList.itemIds) ? [...shoppingList.itemIds] : [];
      let currentQuantities = Array.isArray(shoppingList.quantities) ? [...shoppingList.quantities] : [];

      // For each ingredient in the recipe
      if (dbItem.ingredients && dbItem.ingredients.length > 0) {
        // Get the quantity of this item ordered from Square (default to 1 if missing)
        const itemQuantityOrdered = Number(item.quantity) || 1;
        for (let i = 0; i < dbItem.ingredients.length; i++) {
          const ingredientId = dbItem.ingredients[i];
          const ingredientQtyUsedRaw = dbItem.ingredientsQuantity?.[i] || 0;
          const ingredient = await Inventory.findOne({
            where: {
              id: ingredientId,
              businessId: businessId,
            },
          });

          if (!ingredient) continue;

          // Multiply by the quantity ordered from Square
          const totalQtyUsedRaw = ingredientQtyUsedRaw * itemQuantityOrdered;

          // Convert recipe unit to base unit for subtraction
          const recipeUnit = dbItem.ingredientsUnit && dbItem.ingredientsUnit[i] ? dbItem.ingredientsUnit[i] : (ingredient.baseUnit || ingredient.unit);
          const baseUnit = ingredient.baseUnit || ingredient.unit;
          // Pass conversionRate from inventory to conversion function
          let ingredientQtyUsed = convertToBaseUnit(
            totalQtyUsedRaw,
            recipeUnit,
            baseUnit,
            ingredient.itemName || '',
            ingredient.conversionRate || null
          );

          // For shopping list, round up to the next whole number (can't buy a fraction)
          const ingredientQtyUsedWhole = Math.ceil(ingredientQtyUsed);

          // Subtract the used quantity (in base unit)
          const newQuantity = ingredient.quantityInStock - ingredientQtyUsed;
          await ingredient.update({ quantityInStock: newQuantity });

          // Only add to shopping list if quantity in stock is less than max
          if (newQuantity < ingredient.max) {
            const idx = currentItemIds.indexOf(ingredientId);
            const needed = ingredient.max - newQuantity;
            if (idx === -1) {
              // Not in shopping list: add enough to restock to max (rounded up)
              if (needed > 0) {
                currentItemIds.push(ingredientId);
                currentQuantities.push(Math.ceil(needed));
              }
            } else {
              // Already in shopping list
              if (currentQuantities[idx] >= ingredient.max) {
                // If already at max, just add the new ingredientQtyUsedWhole
                currentQuantities[idx] += ingredientQtyUsedWhole;
              } else {
                // Otherwise, set to needed to restock to max
                if (needed > 0) {
                  currentQuantities[idx] = Math.ceil(needed);
                }
              }
            }
          }
        }
      }

      // Update the shopping list in the DB
      await shoppingList.update({
        itemIds: currentItemIds,
        quantities: currentQuantities,
      });
    }

    console.log('✅ Order processed:', orderId);
  } catch (err) {
    console.error('Error processing Square order webhook:', err);
  }
});

module.exports = { order: router };