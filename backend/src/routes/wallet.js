const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect, requireKYC } = require('../middleware/authMiddleware');

// All wallet routes require authentication
router.use(protect);

// Basic wallet operations
router.get('/', walletController.getWallet);
router.get('/transactions', walletController.getTransactionHistory);
router.get('/withdrawal-requests', walletController.getWithdrawalRequests);

// Money operations (require KYC)
router.use(requireKYC);
router.post('/deposit', walletController.addMoney);
router.post('/withdraw', walletController.withdrawMoney);

// Bank account management
router.post('/bank-accounts', walletController.addBankAccount);

module.exports = router;
