const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const cron = require('node-cron');
const { refreshSquareTokenIfExpiringSoon } = require('./crons/refreshSquareToken');
const { square } = require('./endpoints/oauth/square');
const { user } = require('./endpoints/users/user');
const { business } = require('./endpoints/businesses/business');
const { item } = require('./endpoints/inventory/item');

app.use('/oauth', square);
app.use('/users', user);
app.use('/businesses', business);
app.use('/inventory', item);

cron.schedule('0 4 * * *', async () => {
  console.log('Running Square token refresh job...');
  refreshSquareTokenIfExpiringSoon();
    try {
    const deleted = await ProcessedEvent.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });

    console.log(`🧹 Cleaned up ${deleted} expired ProcessedEvents.`);
  } catch (error) {
    console.error('❌ Error cleaning up expired events:', error);
  }
}, {
  timezone: 'UTC',
});

cron.schedule('0 4 * * *', async () => {
  try {
    const deleted = await ProcessedEvent.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date(),
        },
      },
    });

    console.log(`🧹 Cleaned up ${deleted} expired ProcessedEvents.`);
  } catch (error) {
    console.error('❌ Error cleaning up expired events:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
