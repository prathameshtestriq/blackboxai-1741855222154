const jwt = require('jsonwebtoken');
const { AppError } = require('../../middleware/errorHandler');
const {
  protect,
  restrictTo,
  isLoggedIn,
  requireKYC,
  checkWalletBalance,
  checkTradingStatus,
  checkMarketHours
} = require('../../middleware/authMiddleware');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const PlayerStock = require('../../models/PlayerStock');
const config = require('../../config/config');

describe('Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {},
      cookies: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('protect middleware', () => {
    it('should throw error if no token is provided', async () => {
      await protect(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('not logged in');
    });

    it('should throw error if token is invalid', async () => {
      req.headers.authorization = 'Bearer invalid_token';

      await protect(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('should set user on request if token is valid', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        isVerified: true
      });

      const token = jwt.sign({ id: user._id }, config.jwt.secret);
      req.headers.authorization = `Bearer ${token}`;

      await protect(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toEqual(user._id.toString());
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('restrictTo middleware', () => {
    it('should allow access for correct role', () => {
      req.user = { role: 'admin' };
      const middleware = restrictTo('admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny access for incorrect role', () => {
      req.user = { role: 'user' };
      const middleware = restrictTo('admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('requireKYC middleware', () => {
    it('should allow access if KYC is verified', async () => {
      const user = await User.create({
        username: 'kycuser',
        email: 'kyc@example.com',
        password: 'password123',
        isVerified: true
      });

      await Wallet.create({
        userId: user._id,
        kyc: { status: 'VERIFIED' }
      });

      req.user = user;

      await requireKYC(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny access if KYC is not verified', async () => {
      const user = await User.create({
        username: 'nonkycuser',
        email: 'nonkyc@example.com',
        password: 'password123',
        isVerified: true
      });

      await Wallet.create({
        userId: user._id,
        kyc: { status: 'PENDING' }
      });

      req.user = user;

      await requireKYC(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('checkWalletBalance middleware', () => {
    it('should allow transaction if sufficient balance', async () => {
      const user = await User.create({
        username: 'wealthyuser',
        email: 'wealthy@example.com',
        password: 'password123',
        isVerified: true
      });

      await Wallet.create({
        userId: user._id,
        balance: 1000
      });

      req.user = user;
      req.body = { amount: 500 };

      await checkWalletBalance(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny transaction if insufficient balance', async () => {
      const user = await User.create({
        username: 'pooruser',
        email: 'poor@example.com',
        password: 'password123',
        isVerified: true
      });

      await Wallet.create({
        userId: user._id,
        balance: 100
      });

      req.user = user;
      req.body = { amount: 500 };

      await checkWalletBalance(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('checkTradingStatus middleware', () => {
    it('should allow trading if stock is active', async () => {
      const stock = await PlayerStock.create({
        playerId: '507f1f77bcf86cd799439011',
        name: 'Test Player',
        tradingStatus: 'ACTIVE',
        currentPrice: 100
      });

      req.params = { id: stock._id };

      await checkTradingStatus(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny trading if stock is suspended', async () => {
      const stock = await PlayerStock.create({
        playerId: '507f1f77bcf86cd799439011',
        name: 'Test Player',
        tradingStatus: 'SUSPENDED',
        currentPrice: 100
      });

      req.params = { id: stock._id };

      await checkTradingStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('checkMarketHours middleware', () => {
    const realDateNow = Date.now.bind(global.Date);
    
    afterEach(() => {
      global.Date.now = realDateNow;
    });

    it('should allow trading during market hours', () => {
      // Mock date to be 12:00 PM UTC
      global.Date.now = jest.fn(() => new Date('2024-01-01T12:00:00Z').getTime());

      checkMarketHours(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should deny trading outside market hours', () => {
      // Mock date to be 4:00 AM UTC
      global.Date.now = jest.fn(() => new Date('2024-01-01T04:00:00Z').getTime());

      checkMarketHours(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.any(AppError)
      );
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe('isLoggedIn middleware', () => {
    it('should set user on request if valid token provided', async () => {
      const user = await User.create({
        username: 'optionaluser',
        email: 'optional@example.com',
        password: 'password123',
        isVerified: true
      });

      const token = jwt.sign({ id: user._id }, config.jwt.secret);
      req.headers.authorization = `Bearer ${token}`;

      await isLoggedIn(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toEqual(user._id.toString());
      expect(next).toHaveBeenCalledWith();
    });

    it('should continue without user if no token provided', async () => {
      await isLoggedIn(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should continue without user if invalid token provided', async () => {
      req.headers.authorization = 'Bearer invalid_token';

      await isLoggedIn(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });
});
