const express = require('express');
const router = express.Router();
const { Item, Business, PendingPurchase, ProcessedEvent, ShoppingList } = require('../../models');
const { authenticateJWT } = require('../../middleware/authenticate');
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CATALOG_URL = 'https://connect.squareupsandbox.com/v2/catalog/list?types=ITEM';
const INVENTORY_URL = 'https://connect.squareupsandbox.com/v2/inventory/batch-retrieve-counts';

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
      const unit = firstVariation ? firstVariation.name : '';

      await Item.upsert({
        itemName: item.name || 'Unnamed',
        unitCost: unitCost || 0,
        vendor: '',
        sku: null,
        expirationDate: null,
        unit: unit || 'unit',
        quantityInStock: totalQuantity || 0,
        isPerishable: 'N',
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

// Get all items for the authenticated user's business
router.get('/items', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: businessId missing from token' });
    }

    const items = await Item.findAll({
      where: { businessId }
    });

    res.json(items);
  } catch (error) {
    console.error('❌ Failed to fetch items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST add new item
router.post('/items', authenticateJWT, async (req, res) => {
  try {
    const {
      itemName,
      unitCost,
      vendor,
      upc,
      expirationDate,
      unit,
      quantityInStock,
      isPerishable,
    } = req.body;

    const newItem = await Item.create({
      itemName,
      unitCost,
      vendor,
      upc: upc || null,
      expirationDate: expirationDate || null,
      unit,
      quantityInStock,
      isPerishable,
      businessId: req.user.businessId,
    });

    res.status(201).json(newItem);
  } catch (err) {
    console.error('POST /items error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT update item
router.put('/items/:itemId', authenticateJWT, async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findOne({
      where: {
        itemId,
        businessId: req.user.businessId,
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await item.update({
      ...req.body,
      upc: req.body.upc || null,
      expirationDate: req.body.expirationDate || null,
    });

    res.json(item);
  } catch (err) {
    console.error('PUT /items/:itemId error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE item
router.delete('/items/:itemId', authenticateJWT, async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findOne({
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

router.get('/pending-purchases', authenticateJWT, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({ error: 'Business ID missing from user token' });
    }

    const purchases = await PendingPurchase.findAll({
      where: { businessId },
    });

    res.json(purchases);
  } catch (err) {
    console.error('Error fetching pending purchases:', err);
    res.status(500).json({ error: 'Failed to fetch pending purchases' });
  }
});

// Create a new Pending Purchase
router.post('/pending-purchase', authenticateJWT, async (req, res) => {
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

// GET base shopping list for a business
router.get('/shopping-list', authenticateJWT, async (req, res) => {
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

    // Fetch items with their names
    const items = await Item.findAll({
      where: {
        itemId: itemIds, // assuming Item's PK is itemId
        businessId: businessId,
      },
      attributes: ['itemId', 'itemName'],
    });

    // Map itemId → itemName
    const itemNameMap = {};
    items.forEach(item => {
      itemNameMap[item.itemId] = item.itemName;
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


router.put('/shopping-list', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { itemIds, quantities, cheapestUnitPrice, vendor, totalPrice } = req.body;

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
        cheapestUnitPrice,
        vendor,
        totalPrice,
      });
    } else {
      // Append to existing arrays
      const updatedList = {
        itemIds: [...shoppingList.itemIds, ...itemIds],
        quantities: [...shoppingList.quantities, ...quantities],
        cheapestUnitPrice: [...shoppingList.cheapestUnitPrice, ...cheapestUnitPrice],
        vendor: [...shoppingList.vendor, ...vendor],
        totalPrice: [...shoppingList.totalPrice, ...totalPrice],
      };

      await shoppingList.update(updatedList);
    }

    res.json({ message: 'Shopping list updated successfully', shoppingList });
  } catch (err) {
    console.error('Error updating shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.put('/shopping-list/clear', authenticateJWT, async (req, res) => {
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
      cheapestUnitPrice: [],
      vendor: [],
      totalPrice: [],
    });

    res.json({ message: 'Shopping list cleared successfully', shoppingList });
  } catch (err) {
    console.error('Error clearing shopping list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Updated getOrder to take the token
async function getOrder(orderId, accessToken) {
  const response = await fetch(`https://connect.squareupsandbox.com/v2/orders/${orderId}`, {
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
  const orderUpdated = event.data?.object?.order_updated;

  if (!event || event.type !== 'order.updated' || !orderUpdated?.order_id) {
    return res.status(400).send('Invalid payload');
  }

  const orderId = orderUpdated.order_id;
  const merchantId = event.merchant_id;

  try {
    // Lookup business by Square merchant ID
    const business = await Business.findOne({ where: { squareMerchantId: merchantId } });
    if (!business || !business.squareAccessToken) {
      return res.status(404).send('Business not found or missing access token');
    }

    // Skip if already processed
    const existing = await ProcessedEvent.findByPk(orderId);
    if (existing) {
      console.log('Duplicate webhook ignored:', orderId);
      return res.status(200).send('Already processed');
    }

    // Only process if order is completed
    if (orderUpdated.state === 'COMPLETED') {
      const fullOrder = await getOrder(orderId, business.squareAccessToken);
      // Mark order as processed
      await ProcessedEvent.create({ orderId });
      const businessId = business.id;

      // Extract data from fullOrder.line_items
      const itemIds = [];
      const quantities = [];
      const cheapestUnitPrice = [];
      const vendor = [];
      const totalPrice = [];

      for (const item of fullOrder.line_items || []) {
      const itemName = item.name;

      // Find item in your DB by name and businessId
      const dbItem = await Item.findOne({
        where: {
          itemName: itemName,
          businessId: businessId,
        },
      });

      if (!dbItem) {
        console.warn(`Item not found in DB for business ${businessId}: ${itemName}`);
        continue;
      }

      const inventoryCount = dbItem.quantityInStock;
      const THRESHOLD = dbItem.threshold;
      const quantityNeeded = inventoryCount < THRESHOLD ? THRESHOLD - inventoryCount : 0;

      // Skip if no quantity needed
      if (quantityNeeded <= 0) continue;

      const itemInfo = await getCheapestPriceFromChatGPT(itemName);
  
      itemIds.push(dbItem.itemId);
      quantities.push(quantityNeeded);
      cheapestUnitPrice.push(itemInfo.price);
      vendor.push(itemInfo.vendor);
      totalPrice.push((itemInfo.price * quantityNeeded).toFixed(2));
    }
      // Update Shopping List for this business
      let shoppingList = await ShoppingList.findOne({ where: { businessId } });

      if (!shoppingList) {
        shoppingList = await ShoppingList.create({
          businessId,
          itemIds,
          quantities,
          cheapestUnitPrice,
          vendor,
          totalPrice,
        });
      } else {
        await shoppingList.update({
          itemIds: [...shoppingList.itemIds, ...itemIds],
          quantities: [...shoppingList.quantities, ...quantities],
          cheapestUnitPrice: [...shoppingList.cheapestUnitPrice, ...cheapestUnitPrice],
          vendor: [...shoppingList.vendor, ...vendor],
          totalPrice: [...shoppingList.totalPrice, ...totalPrice],
        });
      }

      console.log(`Shopping list updated for business ${businessId}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Square order webhook:', err);
    res.status(500).send('Failed to process order');
  }
});

async function getCheapestPriceFromChatGPT(itemName) {
  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You help identify cheap vendor options for food inventory.'
      },
      {
        role: 'user',
        content: `what is the cheapest unit price and vendor/store for ${itemName} in fort wayne, indiana right now. give me only one option. when you return the response do this format: Vendor: vendor Price: price`
      }
    ]
  });

  const response = chat.choices[0].message.content.trim();
  console.log('ChatGPT response:', response);

  // Expected format: "Vendor: McDonald's Price: $1.00"
  const match = response.match(/Vendor:\s*(.+?)\s+Price:\s*\$?([\d.]+)/i);

  if (match) {
    const vendor = match[1].trim();
    const price = parseFloat(match[2]);
    return { vendor, price };
  } else {
    console.warn('⚠️ Could not parse ChatGPT response:', response);
    return { vendor: 'Unknown', price: 1.0 };
  }
}

router.get('/recipes', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;

  if (!businessId) {
    return res.status(400).json({ error: 'Business ID missing from token' });
  }

  try {
    const items = await Item.findAll({
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

router.post('/recipes', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { title, unitCost, ingredients, ingredientsQuantity, ingredientsUnit } = req.body;

  if (!businessId || !title || !ingredients) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Item.create({
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

router.put('/recipes/:id', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { id } = req.params;
  const { title, unitCost, ingredients, ingredientsQuantity, ingredientsUnit } = req.body;

  if (!businessId || !id || !title || !ingredients) {
    return res.status(400).json({ error: 'Missing data' });
  }

  try {
    const item = await Item.findOne({
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

router.delete('/recipes/:id', authenticateJWT, async (req, res) => {
  const businessId = req.user.businessId;
  const { id } = req.params;

  try {
    const item = await Item.findOne({
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

module.exports = { item: router };
