const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const PlayerStock = require('../../models/PlayerStock');
const { logger } = require('../../utils/logger');

describe('PlayerStock Controller', () => {
  let user;
  let token;
  let wallet;
  let playerStock;

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Test123!@#',
    isVerified: true
  };

  beforeEach(async () => {
    // Create test user
    user = await User.create(testUser);
    token = user.generateAuthToken();

    // Create wallet for user
    wallet = await Wallet.create({
      userId: user._id,
      balance: 10000,
      kyc: {
        status: 'VERIFIED'
      }
    });

    // Create test player stock
    playerStock = await PlayerStock.create({
      playerId: '507f1f77bcf86cd799439011', // Dummy ObjectId
      name: 'Virat Kohli',
      currentPrice: 1000,
      previousPrice: 950,
      totalSupply: 1000000,
      circulatingSupply: 500000,
      tradingStatus: 'ACTIVE',
      priceHistory: [
        {
          price: 950,
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          price: 1000,
          timestamp: new Date()
        }
      ]
    });
  });

  describe('GET /api/player-stocks', () => {
    it('should return all player stocks with pagination', async () => {
      const res = await request(app)
        .get('/api/player-stocks')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.stocks).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter stocks by price range', async () => {
      const res = await request(app)
        .get('/api/player-stocks?minPrice=900&maxPrice=1100')
        .expect(200);

      expect(res.body.data.stocks).toHaveLength(1);
      expect(res.body.data.stocks[0].currentPrice).toBeLessThanOrEqual(1100);
      expect(res.body.data.stocks[0].currentPrice).toBeGreaterThanOrEqual(900);
    });

    it('should sort stocks by price', async () => {
      // Create another stock with different price
      await PlayerStock.create({
        playerId: '507f1f77bcf86cd799439012',
        name: 'MS Dhoni',
        currentPrice: 1200,
        totalSupply: 1000000,
        circulatingSupply: 500000,
        tradingStatus: 'ACTIVE'
      });

      const res = await request(app)
        .get('/api/player-stocks?sort=currentPrice&order=desc')
        .expect(200);

      expect(res.body.data.stocks).toHaveLength(2);
      expect(res.body.data.stocks[0].currentPrice).toBeGreaterThan(
        res.body.data.stocks[1].currentPrice
      );
    });
  });

  describe('GET /api/player-stocks/:id', () => {
    it('should return stock details', async () => {
      const res = await request(app)
        .get(`/api/player-stocks/${playerStock._id}`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.stock).toHaveProperty('name', 'Virat Kohli');
      expect(res.body.data.stock).toHaveProperty('currentPrice', 1000);
    });

    it('should return error for non-existent stock', async () => {
      const res = await request(app)
        .get('/api/player-stocks/507f1f77bcf86cd799439099')
        .expect(404);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Stock not found');
    });
  });

  describe('POST /api/player-stocks/:id/buy', () => {
    it('should buy stock successfully', async () => {
      const quantity = 5;
      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.transaction).toHaveProperty('type', 'BUY');
      expect(res.body.data.transaction).toHaveProperty('quantity', quantity);
      expect(res.body.data.portfolio).toBeDefined();
      
      // Check wallet balance was updated
      const updatedWallet = await Wallet.findOne({ userId: user._id });
      expect(updatedWallet.balance).toBe(10000 - (quantity * playerStock.currentPrice));
    });

    it('should return error for insufficient balance', async () => {
      const quantity = 20; // More than wallet balance can afford
      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Insufficient wallet balance');
    });

    it('should return error for suspended trading', async () => {
      await PlayerStock.findByIdAndUpdate(playerStock._id, {
        tradingStatus: 'SUSPENDED'
      });

      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/buy`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 1 })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Trading is currently suspended');
    });
  });

  describe('POST /api/player-stocks/:id/sell', () => {
    beforeEach(async () => {
      // Add stocks to user's portfolio
      user.portfolio.push({
        playerId: playerStock._id,
        quantity: 10,
        averageBuyPrice: 950
      });
      await user.save();
    });

    it('should sell stock successfully', async () => {
      const quantity = 5;
      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.transaction).toHaveProperty('type', 'SELL');
      expect(res.body.data.transaction).toHaveProperty('quantity', quantity);
      
      // Check portfolio was updated
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.portfolio[0].quantity).toBe(5);
    });

    it('should return error for insufficient stock quantity', async () => {
      const quantity = 15; // More than portfolio quantity
      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/sell`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Insufficient stock quantity');
    });
  });

  describe('GET /api/player-stocks/:id/price-history', () => {
    it('should return price history for different timeframes', async () => {
      const res = await request(app)
        .get(`/api/player-stocks/${playerStock._id}/price-history?timeframe=1d`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.priceHistory).toHaveLength(2);
      expect(res.body.data.priceHistory[0]).toHaveProperty('price');
      expect(res.body.data.priceHistory[0]).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/player-stocks/:id/ipo', () => {
    beforeEach(async () => {
      // Add an active IPO
      await PlayerStock.findByIdAndUpdate(playerStock._id, {
        matchIPO: [{
          matchId: '507f1f77bcf86cd799439013',
          basePrice: 800,
          maxPrice: 1200,
          availableStocks: 1000,
          startTime: new Date(),
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'ACTIVE'
        }]
      });
    });

    it('should return IPO details', async () => {
      const res = await request(app)
        .get(`/api/player-stocks/${playerStock._id}/ipo`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.ipo).toHaveProperty('basePrice', 800);
      expect(res.body.data.ipo).toHaveProperty('status', 'ACTIVE');
    });

    it('should participate in IPO successfully', async () => {
      const quantity = 5;
      const res = await request(app)
        .post(`/api/player-stocks/${playerStock._id}/ipo/participate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.transaction).toHaveProperty('type', 'IPO_INVESTMENT');
      expect(res.body.data.ipo.soldStocks).toBe(quantity);
    });
  });
});
