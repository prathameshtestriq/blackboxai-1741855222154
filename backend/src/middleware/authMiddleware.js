const jwt = require('jsonwebtoken');
const { AppError, catchAsync } = require('./errorHandler');
const User = require('../models/User');
const config = require('../config/config');

// Protect routes - Authentication check
const protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }

  // 2) Verify token
  const decoded = jwt.verify(token, config.jwt.secret);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // 4) Check if user is verified
  if (!currentUser.isVerified) {
    return next(new AppError('Please verify your email address to access this resource.', 403));
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

// Restrict routes to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

// Check if user is logged in (for optional authentication)
const isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1) Verify token
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);

      // 2) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (currentUser) {
        req.user = currentUser;
      }
    } catch (error) {
      // Don't throw error, just continue without user
    }
  }
  next();
});

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false
});

// KYC verification middleware
const requireKYC = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('wallet');
  
  if (!user.wallet?.kyc?.status === 'VERIFIED') {
    return next(new AppError('Please complete KYC verification to access this feature', 403));
  }
  
  next();
});

// Wallet balance check middleware
const checkWalletBalance = catchAsync(async (req, res, next) => {
  const { amount } = req.body;
  const user = await User.findById(req.user.id).populate('wallet');
  
  if (!user.wallet || user.wallet.balance < amount) {
    return next(new AppError('Insufficient wallet balance', 400));
  }
  
  next();
});

// Trading status check middleware
const checkTradingStatus = catchAsync(async (req, res, next) => {
  const { stockId } = req.params;
  const stock = await PlayerStock.findById(stockId);
  
  if (!stock || stock.tradingStatus !== 'ACTIVE') {
    return next(new AppError('Trading is currently suspended for this stock', 400));
  }
  
  next();
});

// Market hours check middleware
const checkMarketHours = (req, res, next) => {
  const now = new Date();
  const hour = now.getUTCHours();
  
  // Example: Market hours 9:30 AM to 4:00 PM UTC
  if (hour < 9 || (hour === 9 && now.getUTCMinutes() < 30) || hour >= 16) {
    return next(new AppError('Market is currently closed', 400));
  }
  
  next();
};

// WebSocket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

module.exports = {
  protect,
  restrictTo,
  isLoggedIn,
  loginLimiter,
  apiLimiter,
  requireKYC,
  checkWalletBalance,
  checkTradingStatus,
  checkMarketHours,
  authenticateSocket
};
