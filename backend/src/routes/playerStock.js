const express = require('express');
const router = express.Router();
const playerStockController = require('../controllers/playerStockController');
const { 
  protect, 
  requireKYC, 
  checkWalletBalance,
  checkTradingStatus,
  checkMarketHours 
} = require('../middleware/authMiddleware');

// Public routes
router.get('/', playerStockController.getAllStocks);
router.get('/:id', playerStockController.getStock);
router.get('/:id/price-history', playerStockController.getPriceHistory);
router.get('/:id/ipo', playerStockController.getIPODetails);

// Protected routes
router.use(protect);
router.use(requireKYC);
router.use(checkMarketHours);

// Trading routes with additional middleware
router.post(
  '/:id/buy',
  checkTradingStatus,
  checkWalletBalance,
  playerStockController.buyStock
);

router.post(
  '/:id/sell',
  checkTradingStatus,
  playerStockController.sellStock
);

router.post(
  '/:id/ipo/participate',
  checkWalletBalance,
  playerStockController.participateInIPO
);

module.exports = router;
