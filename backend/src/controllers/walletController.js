const Wallet = require('../models/Wallet');
const User = require('../models/User');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const emailService = require('../utils/emailService');

// Get wallet details
exports.getWallet = catchAsync(async (req, res, next) => {
  const wallet = await Wallet.findOne({ userId: req.user.id });

  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      wallet
    }
  });
});

// Add money to wallet
exports.addMoney = catchAsync(async (req, res, next) => {
  const { amount, paymentMethod, paymentDetails } = req.body;

  if (amount <= 0) {
    return next(new AppError('Amount must be greater than 0', 400));
  }

  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  // Check daily deposit limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyDeposits = wallet.transactions.reduce((total, transaction) => {
    if (
      transaction.type === 'DEPOSIT' &&
      transaction.status === 'COMPLETED' &&
      transaction.timestamp >= today
    ) {
      return total + transaction.amount;
    }
    return total;
  }, 0);

  if (dailyDeposits + amount > wallet.limits.dailyDeposit) {
    return next(new AppError('Daily deposit limit exceeded', 400));
  }

  // Simulate payment processing
  const paymentResponse = await processPayment(amount, paymentMethod, paymentDetails);

  if (paymentResponse.status === 'success') {
    // Add transaction
    const transaction = await wallet.addTransaction({
      type: 'DEPOSIT',
      amount,
      status: 'COMPLETED',
      paymentDetails: {
        paymentId: paymentResponse.paymentId,
        paymentMethod,
        paymentStatus: 'SUCCESS',
        paymentResponse
      }
    });

    logger.info('Money added to wallet successfully', {
      userId: req.user.id,
      amount,
      transactionId: transaction._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        transaction,
        balance: wallet.balance
      }
    });
  } else {
    // Log failed payment attempt
    await wallet.addTransaction({
      type: 'DEPOSIT',
      amount,
      status: 'FAILED',
      paymentDetails: {
        paymentMethod,
        paymentStatus: 'FAILED',
        paymentResponse
      }
    });

    logger.error('Payment failed', {
      userId: req.user.id,
      amount,
      error: paymentResponse.error
    });

    return next(new AppError('Payment failed. Please try again.', 400));
  }
});

// Withdraw money from wallet
exports.withdrawMoney = catchAsync(async (req, res, next) => {
  const { amount, bankDetails } = req.body;

  if (amount <= 0) {
    return next(new AppError('Amount must be greater than 0', 400));
  }

  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  // Check minimum withdrawal amount
  if (amount < wallet.limits.minWithdrawal) {
    return next(new AppError(`Minimum withdrawal amount is ${wallet.limits.minWithdrawal}`, 400));
  }

  // Check daily withdrawal limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyWithdrawals = wallet.transactions.reduce((total, transaction) => {
    if (
      transaction.type === 'WITHDRAW' &&
      transaction.status === 'COMPLETED' &&
      transaction.timestamp >= today
    ) {
      return total + transaction.amount;
    }
    return total;
  }, 0);

  if (dailyWithdrawals + amount > wallet.limits.dailyWithdrawal) {
    return next(new AppError('Daily withdrawal limit exceeded', 400));
  }

  // Check if bank account is verified
  const verifiedAccount = wallet.savedBankAccounts.find(
    account => account.isVerified && 
    account.accountNumber === bankDetails.accountNumber
  );

  if (!verifiedAccount) {
    return next(new AppError('Please use a verified bank account', 400));
  }

  // Create withdrawal request
  const withdrawalRequest = {
    amount,
    bankDetails,
    status: 'PENDING',
    requestedAt: new Date()
  };

  wallet.withdrawalRequests.push(withdrawalRequest);
  await wallet.save();

  // Create pending transaction
  const transaction = await wallet.addTransaction({
    type: 'WITHDRAW',
    amount,
    status: 'PENDING',
    bankDetails
  });

  logger.info('Withdrawal request created', {
    userId: req.user.id,
    amount,
    transactionId: transaction._id
  });

  res.status(200).json({
    status: 'success',
    data: {
      withdrawalRequest,
      transaction
    }
  });
});

// Get transaction history
exports.getTransactionHistory = catchAsync(async (req, res, next) => {
  const { 
    type,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 10
  } = req.query;

  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  // Build query
  let transactions = wallet.transactions;

  if (type) {
    transactions = transactions.filter(t => t.type === type);
  }

  if (status) {
    transactions = transactions.filter(t => t.status === status);
  }

  if (startDate || endDate) {
    transactions = transactions.filter(t => {
      if (startDate && t.timestamp < new Date(startDate)) return false;
      if (endDate && t.timestamp > new Date(endDate)) return false;
      return true;
    });
  }

  // Sort by timestamp descending
  transactions.sort((a, b) => b.timestamp - a.timestamp);

  // Apply pagination
  const total = transactions.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  transactions = transactions.slice(start, end);

  res.status(200).json({
    status: 'success',
    data: {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Add bank account
exports.addBankAccount = catchAsync(async (req, res, next) => {
  const { accountNumber, bankName, ifscCode, accountHolderName } = req.body;

  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  // Check if account already exists
  const existingAccount = wallet.savedBankAccounts.find(
    account => account.accountNumber === accountNumber
  );

  if (existingAccount) {
    return next(new AppError('Bank account already exists', 400));
  }

  const bankAccount = await wallet.addBankAccount({
    accountNumber,
    bankName,
    ifscCode,
    accountHolderName
  });

  logger.info('Bank account added', {
    userId: req.user.id,
    accountNumber
  });

  res.status(200).json({
    status: 'success',
    data: {
      bankAccount
    }
  });
});

// Get withdrawal requests
exports.getWithdrawalRequests = catchAsync(async (req, res, next) => {
  const { status, page = 1, limit = 10 } = req.query;

  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet) {
    return next(new AppError('Wallet not found', 404));
  }

  let requests = wallet.withdrawalRequests;

  if (status) {
    requests = requests.filter(r => r.status === status);
  }

  // Sort by requestedAt descending
  requests.sort((a, b) => b.requestedAt - a.requestedAt);

  // Apply pagination
  const total = requests.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  requests = requests.slice(start, end);

  res.status(200).json({
    status: 'success',
    data: {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Helper function to simulate payment processing
const processPayment = async (amount, paymentMethod, paymentDetails) => {
  // This is a mock implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'success',
        paymentId: 'PAY' + Date.now(),
        amount,
        timestamp: new Date()
      });
    }, 1000);
  });
};
