const express = require('express');
const router = express.Router();
const { Recipe, Business, ProcessedEvent, ShoppingList } = require('../../models');
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

module.exports = { order: router };