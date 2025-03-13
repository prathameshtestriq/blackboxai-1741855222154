const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { logger } = require('./src/utils/logger');
const config = require('./src/config/config');

// Import routes
const authRoutes = require('./src/routes/auth');
const matchRoutes = require('./src/routes/match');
const playerStockRoutes = require('./src/routes/playerStock');
const walletRoutes = require('./src/routes/wallet');

// Import middleware
const { errorHandler, notFound } = require('./src/middleware/errorHandler');
const { apiLimiter } = require('./src/middleware/authMiddleware');

// Create Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: config.socketCorsOrigin,
    methods: ['GET', 'POST']
  }
});

// Store socket.io instance on app
app.set('io', io);

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Rate limiting
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
  logger.logAPIRequest(req);
  
  // Log response
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logAPIResponse(req, res, duration);
  });
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/player-stocks', playerStockRoutes);
app.use('/api/wallet', walletRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date()
  });
});

// Handle 404 routes
app.use(notFound);

// Error handling
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('New WebSocket connection', { socketId: socket.id });

  // Join match room
  socket.on('joinMatch', (matchId) => {
    socket.join(`match_${matchId}`);
    logger.info('Client joined match room', { socketId: socket.id, matchId });
  });

  // Leave match room
  socket.on('leaveMatch', (matchId) => {
    socket.leave(`match_${matchId}`);
    logger.info('Client left match room', { socketId: socket.id, matchId });
  });

  // Subscribe to stock updates
  socket.on('subscribeStock', (stockId) => {
    socket.join(`stock_${stockId}`);
    logger.info('Client subscribed to stock updates', { socketId: socket.id, stockId });
  });

  // Unsubscribe from stock updates
  socket.on('unsubscribeStock', (stockId) => {
    socket.leave(`stock_${stockId}`);
    logger.info('Client unsubscribed from stock updates', { socketId: socket.id, stockId });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Start server
const PORT = config.port || 3000;
server.listen(PORT, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = app;
