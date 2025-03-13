const winston = require('winston');
const config = require('../config/config');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define level based on environment
const level = () => {
  const env = config.nodeEnv || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

// Tell winston that we want to link the colors
winston.addColors(colors);

// Custom format for logging
const format = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Add colors
  winston.format.colorize({ all: true }),
  // Define the format of the message showing the timestamp, the level and the message
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use to print out messages
const transports = [
  // Allow the use the console to print the messages
  new winston.transports.Console(),
  // Allow to print all the error level messages inside the error.log file
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  // Allow to print all the messages inside the all.log file
  new winston.transports.File({ filename: 'logs/all.log' }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Create a stream object with a 'write' function that will be used by morgan
const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

class Logger {
  constructor() {
    this.logger = logger;
  }

  // Log error messages
  error(message, meta = {}) {
    this.logger.error(message, { meta });
  }

  // Log warning messages
  warn(message, meta = {}) {
    this.logger.warn(message, { meta });
  }

  // Log info messages
  info(message, meta = {}) {
    this.logger.info(message, { meta });
  }

  // Log HTTP requests
  http(message, meta = {}) {
    this.logger.http(message, { meta });
  }

  // Log debug messages
  debug(message, meta = {}) {
    this.logger.debug(message, { meta });
  }

  // Log API requests
  logAPIRequest(req, meta = {}) {
    const message = `${req.method} ${req.originalUrl}`;
    this.http(message, {
      ...meta,
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.headers['user-agent']
    });
  }

  // Log API responses
  logAPIResponse(req, res, responseTime, meta = {}) {
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`;
    this.http(message, {
      ...meta,
      ip: req.ip,
      userId: req.user?.id,
      statusCode: res.statusCode,
      responseTime
    });
  }

  // Log errors with stack trace
  logError(error, req = null, meta = {}) {
    const errorMeta = {
      ...meta,
      stack: error.stack,
      userId: req?.user?.id,
      url: req?.originalUrl,
      method: req?.method
    };

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorMeta.responseData = {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      };
    } else if (error.request) {
      // The request was made but no response was received
      errorMeta.requestData = error.request;
    }

    this.error(error.message, errorMeta);
  }

  // Log database operations
  logDBOperation(operation, collection, query, duration, meta = {}) {
    const message = `DB ${operation} on ${collection} took ${duration}ms`;
    this.debug(message, {
      ...meta,
      operation,
      collection,
      query,
      duration
    });
  }

  // Log authentication events
  logAuthEvent(type, userId, success, meta = {}) {
    const message = `Auth ${type} - User: ${userId} - Success: ${success}`;
    this.info(message, {
      ...meta,
      type,
      userId,
      success
    });
  }

  // Log stock trading events
  logTradeEvent(userId, stockId, type, quantity, price, meta = {}) {
    const message = `Trade ${type} - User: ${userId} - Stock: ${stockId} - Quantity: ${quantity} - Price: ${price}`;
    this.info(message, {
      ...meta,
      userId,
      stockId,
      type,
      quantity,
      price
    });
  }

  // Log wallet transactions
  logWalletTransaction(userId, type, amount, status, meta = {}) {
    const message = `Wallet ${type} - User: ${userId} - Amount: ${amount} - Status: ${status}`;
    this.info(message, {
      ...meta,
      userId,
      type,
      amount,
      status
    });
  }

  // Log match updates
  logMatchUpdate(matchId, type, data, meta = {}) {
    const message = `Match Update ${type} - Match: ${matchId}`;
    this.info(message, {
      ...meta,
      matchId,
      type,
      data
    });
  }

  // Log system events
  logSystemEvent(type, message, meta = {}) {
    this.info(`System Event: ${type} - ${message}`, {
      ...meta,
      type
    });
  }
}

module.exports = {
  logger: new Logger(),
  stream
};
