const PlayerStock = require('../models/PlayerStock');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const emailService = require('../utils/emailService');

// Get all player stocks
exports.getAllStocks = catchAsync(async (req, res, next) => {
  const { 
    sort = 'currentPrice',
    order = 'desc',
    page = 1,
    limit = 10,
    minPrice,
    maxPrice,
    tradingStatus
  } = req.query;

  // Build query
  const query = {};

  if (minPrice || maxPrice) {
    query.currentPrice = {};
    if (minPrice) query.currentPrice.$gte = parseFloat(minPrice);
    if (maxPrice) query.currentPrice.$lte = parseFloat(maxPrice);
  }

  if (tradingStatus) {
    query.tradingStatus = tradingStatus;
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const stocks = await PlayerStock.find(query)
    .sort({ [sort]: order === 'desc' ? -1 : 1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await PlayerStock.countDocuments(query);

  res.status(200).json({
    status: 'success',
    data: {
      stocks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get single stock details
exports.getStock = catchAsync(async (req, res, next) => {
  const stock = await PlayerStock.findById(req.params.id);

  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      stock
    }
  });
});

// Buy stock
exports.buyStock = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;
  const stockId = req.params.id;

  const stock = await PlayerStock.findById(stockId);
  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  if (stock.tradingStatus !== 'ACTIVE') {
    return next(new AppError('Trading is currently suspended for this stock', 400));
  }

  const totalAmount = stock.currentPrice * quantity;

  // Check user's wallet balance
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet || wallet.balance < totalAmount) {
    return next(new AppError('Insufficient wallet balance', 400));
  }

  // Update user's portfolio
  const user = await User.findById(req.user.id);
  const portfolioIndex = user.portfolio.findIndex(
    item => item.playerId.toString() === stockId
  );

  if (portfolioIndex === -1) {
    user.portfolio.push({
      playerId: stockId,
      quantity,
      averageBuyPrice: stock.currentPrice
    });
  } else {
    const currentHolding = user.portfolio[portfolioIndex];
    const newQuantity = currentHolding.quantity + quantity;
    const newAveragePrice = (
      (currentHolding.averageBuyPrice * currentHolding.quantity) +
      (stock.currentPrice * quantity)
    ) / newQuantity;

    user.portfolio[portfolioIndex].quantity = newQuantity;
    user.portfolio[portfolioIndex].averageBuyPrice = newAveragePrice;
  }

  // Add transaction to user's history
  user.transactions.push({
    type: 'BUY',
    playerId: stockId,
    quantity,
    price: stock.currentPrice,
    amount: totalAmount
  });

  await user.save();

  // Update wallet
  await wallet.addTransaction({
    type: 'STOCK_BUY',
    amount: totalAmount,
    status: 'COMPLETED',
    stockDetails: {
      stockId,
      quantity,
      pricePerUnit: stock.currentPrice
    }
  });

  // Update stock trading volume
  stock.tradingVolume.daily += quantity;
  await stock.save();

  // Send confirmation email
  try {
    await emailService.sendStockPurchaseConfirmationEmail(user, {
      playerName: stock.name,
      quantity,
      pricePerShare: stock.currentPrice,
      totalAmount,
      transactionId: user.transactions[user.transactions.length - 1]._id
    });
  } catch (error) {
    logger.error('Error sending stock purchase confirmation email', { error, userId: user._id });
  }

  logger.info('Stock purchase successful', {
    userId: user._id,
    stockId,
    quantity,
    price: stock.currentPrice,
    totalAmount
  });

  res.status(200).json({
    status: 'success',
    data: {
      transaction: user.transactions[user.transactions.length - 1],
      portfolio: user.portfolio,
      walletBalance: wallet.balance
    }
  });
});

// Sell stock
exports.sellStock = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;
  const stockId = req.params.id;

  const stock = await PlayerStock.findById(stockId);
  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  if (stock.tradingStatus !== 'ACTIVE') {
    return next(new AppError('Trading is currently suspended for this stock', 400));
  }

  // Check user's portfolio
  const user = await User.findById(req.user.id);
  const portfolioIndex = user.portfolio.findIndex(
    item => item.playerId.toString() === stockId
  );

  if (portfolioIndex === -1 || user.portfolio[portfolioIndex].quantity < quantity) {
    return next(new AppError('Insufficient stock quantity in portfolio', 400));
  }

  const totalAmount = stock.currentPrice * quantity;

  // Update user's portfolio
  const currentHolding = user.portfolio[portfolioIndex];
  const newQuantity = currentHolding.quantity - quantity;

  if (newQuantity === 0) {
    user.portfolio.splice(portfolioIndex, 1);
  } else {
    user.portfolio[portfolioIndex].quantity = newQuantity;
  }

  // Add transaction to user's history
  user.transactions.push({
    type: 'SELL',
    playerId: stockId,
    quantity,
    price: stock.currentPrice,
    amount: totalAmount
  });

  await user.save();

  // Update wallet
  const wallet = await Wallet.findOne({ userId: req.user.id });
  await wallet.addTransaction({
    type: 'STOCK_SELL',
    amount: totalAmount,
    status: 'COMPLETED',
    stockDetails: {
      stockId,
      quantity,
      pricePerUnit: stock.currentPrice
    }
  });

  // Update stock trading volume
  stock.tradingVolume.daily += quantity;
  await stock.save();

  logger.info('Stock sale successful', {
    userId: user._id,
    stockId,
    quantity,
    price: stock.currentPrice,
    totalAmount
  });

  res.status(200).json({
    status: 'success',
    data: {
      transaction: user.transactions[user.transactions.length - 1],
      portfolio: user.portfolio,
      walletBalance: wallet.balance
    }
  });
});

// Get stock price history
exports.getPriceHistory = catchAsync(async (req, res, next) => {
  const { timeframe = '1d' } = req.query;
  const stock = await PlayerStock.findById(req.params.id);

  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  let startTime;
  switch (timeframe) {
    case '1d':
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '1w':
      startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1m':
      startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  const priceHistory = stock.priceHistory.filter(
    ph => ph.timestamp >= startTime
  );

  res.status(200).json({
    status: 'success',
    data: {
      priceHistory
    }
  });
});

// Get stock IPO details
exports.getIPODetails = catchAsync(async (req, res, next) => {
  const stock = await PlayerStock.findById(req.params.id);

  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  const activeIPO = stock.matchIPO.find(
    ipo => ipo.status === 'ACTIVE' || ipo.status === 'UPCOMING'
  );

  res.status(200).json({
    status: 'success',
    data: {
      ipo: activeIPO
    }
  });
});

// Participate in IPO
exports.participateInIPO = catchAsync(async (req, res, next) => {
  const { quantity } = req.body;
  const stockId = req.params.id;

  const stock = await PlayerStock.findById(stockId);
  if (!stock) {
    return next(new AppError('Stock not found', 404));
  }

  const activeIPO = stock.matchIPO.find(ipo => ipo.status === 'ACTIVE');
  if (!activeIPO) {
    return next(new AppError('No active IPO found for this stock', 400));
  }

  if (activeIPO.availableStocks < quantity) {
    return next(new AppError('Requested quantity exceeds available stocks', 400));
  }

  const totalAmount = activeIPO.basePrice * quantity;

  // Check user's wallet balance
  const wallet = await Wallet.findOne({ userId: req.user.id });
  if (!wallet || wallet.balance < totalAmount) {
    return next(new AppError('Insufficient wallet balance', 400));
  }

  // Update IPO details
  activeIPO.availableStocks -= quantity;
  activeIPO.soldStocks += quantity;
  await stock.save();

  // Update user's portfolio and wallet
  const user = await User.findById(req.user.id);
  user.portfolio.push({
    playerId: stockId,
    quantity,
    averageBuyPrice: activeIPO.basePrice
  });

  user.transactions.push({
    type: 'IPO_INVESTMENT',
    playerId: stockId,
    quantity,
    price: activeIPO.basePrice,
    amount: totalAmount
  });

  await user.save();

  // Update wallet
  await wallet.addTransaction({
    type: 'IPO_INVESTMENT',
    amount: totalAmount,
    status: 'COMPLETED',
    stockDetails: {
      stockId,
      quantity,
      pricePerUnit: activeIPO.basePrice
    }
  });

  logger.info('IPO participation successful', {
    userId: user._id,
    stockId,
    quantity,
    price: activeIPO.basePrice,
    totalAmount
  });

  res.status(200).json({
    status: 'success',
    data: {
      transaction: user.transactions[user.transactions.length - 1],
      portfolio: user.portfolio,
      walletBalance: wallet.balance,
      ipo: activeIPO
    }
  });
});
