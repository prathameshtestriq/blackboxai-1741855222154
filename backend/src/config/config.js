require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // MongoDB configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/cricket-stock-exchange'
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT) || 1025,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'Cricket Stock Exchange <noreply@cricketstockexchange.com>'
  },

  // Client URL
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Payment gateway configuration
  payment: {
    apiKey: process.env.PAYMENT_API_KEY,
    apiSecret: process.env.PAYMENT_API_SECRET,
    environment: process.env.PAYMENT_ENVIRONMENT || 'sandbox'
  },

  // Socket.IO configuration
  socketCorsOrigin: process.env.SOCKET_CORS_ORIGIN || '*',

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug'
  },

  // Admin user configuration
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@cricketstockexchange.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123!@#'
  },

  // Market hours (UTC)
  marketHours: {
    open: {
      hour: parseInt(process.env.MARKET_OPEN_HOUR) || 9,
      minute: parseInt(process.env.MARKET_OPEN_MINUTE) || 30
    },
    close: {
      hour: parseInt(process.env.MARKET_CLOSE_HOUR) || 16,
      minute: parseInt(process.env.MARKET_CLOSE_MINUTE) || 0
    }
  },

  // Trading limits
  tradingLimits: {
    maxStockQuantityPerTrade: parseInt(process.env.MAX_STOCK_QUANTITY_PER_TRADE) || 1000,
    minStockQuantityPerTrade: parseInt(process.env.MIN_STOCK_QUANTITY_PER_TRADE) || 1,
    maxDailyTradingVolume: parseInt(process.env.MAX_DAILY_TRADING_VOLUME) || 10000
  },

  // Wallet limits
  walletLimits: {
    maxDailyDeposit: parseInt(process.env.MAX_DAILY_DEPOSIT) || 50000,
    maxDailyWithdrawal: parseInt(process.env.MAX_DAILY_WITHDRAWAL) || 25000,
    minDepositAmount: parseInt(process.env.MIN_DEPOSIT_AMOUNT) || 100,
    minWithdrawalAmount: parseInt(process.env.MIN_WITHDRAWAL_AMOUNT) || 100
  },

  // Validation functions
  validate: {
    isProduction() {
      return this.nodeEnv === 'production';
    },

    isDevelopment() {
      return this.nodeEnv === 'development';
    },

    isTest() {
      return this.nodeEnv === 'test';
    },

    isMarketOpen() {
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();

      const openTime = this.marketHours.open.hour * 60 + this.marketHours.open.minute;
      const closeTime = this.marketHours.close.hour * 60 + this.marketHours.close.minute;
      const currentTime = currentHour * 60 + currentMinute;

      return currentTime >= openTime && currentTime < closeTime;
    },

    isValidTradeQuantity(quantity) {
      return (
        quantity >= this.tradingLimits.minStockQuantityPerTrade &&
        quantity <= this.tradingLimits.maxStockQuantityPerTrade
      );
    },

    isValidDepositAmount(amount) {
      return (
        amount >= this.walletLimits.minDepositAmount &&
        amount <= this.walletLimits.maxDailyDeposit
      );
    },

    isValidWithdrawalAmount(amount) {
      return (
        amount >= this.walletLimits.minWithdrawalAmount &&
        amount <= this.walletLimits.maxDailyWithdrawal
      );
    }
  }
};

// Validate required environment variables in production
if (config.validate.isProduction()) {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
    'PAYMENT_API_KEY',
    'PAYMENT_API_SECRET'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Environment variable ${envVar} is required in production`);
    }
  }
}

module.exports = config;
