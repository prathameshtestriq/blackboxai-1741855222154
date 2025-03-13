const mongoose = require('mongoose');

const playerStockSchema = new mongoose.Schema({
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  currentPrice: {
    type: Number,
    required: true,
    min: [0, 'Stock price cannot be negative']
  },
  previousPrice: {
    type: Number,
    default: 0
  },
  priceHistory: [{
    price: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  matchIPO: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    basePrice: {
      type: Number,
      required: true
    },
    maxPrice: {
      type: Number,
      required: true
    },
    availableStocks: {
      type: Number,
      required: true
    },
    soldStocks: {
      type: Number,
      default: 0
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
      default: 'UPCOMING'
    }
  }],
  tradingVolume: {
    daily: {
      type: Number,
      default: 0
    },
    weekly: {
      type: Number,
      default: 0
    },
    monthly: {
      type: Number,
      default: 0
    }
  },
  marketCap: {
    type: Number,
    default: 0
  },
  totalSupply: {
    type: Number,
    required: true
  },
  circulatingSupply: {
    type: Number,
    default: 0
  },
  performance: {
    daily: {
      type: Number,  // Percentage change
      default: 0
    },
    weekly: {
      type: Number,
      default: 0
    },
    monthly: {
      type: Number,
      default: 0
    }
  },
  matchPerformance: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    stats: {
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      strikeRate: Number,
      overs: Number,
      maidens: Number,
      wickets: Number,
      economy: Number,
      catches: Number,
      runouts: Number,
      stumpings: Number
    },
    priceImpact: {
      type: Number,  // Percentage change in price due to performance
      default: 0
    }
  }],
  tradingStatus: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'DELISTED'],
    default: 'ACTIVE'
  },
  volatilityIndex: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
playerStockSchema.index({ playerId: 1 });
playerStockSchema.index({ currentPrice: 1 });
playerStockSchema.index({ 'matchIPO.matchId': 1 });
playerStockSchema.index({ tradingStatus: 1 });

// Method to update stock price
playerStockSchema.methods.updatePrice = async function(newPrice) {
  this.previousPrice = this.currentPrice;
  this.currentPrice = newPrice;
  
  // Add to price history
  this.priceHistory.push({
    price: newPrice,
    timestamp: new Date()
  });

  // Calculate daily performance
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyStartPrice = this.priceHistory.find(ph => 
    ph.timestamp >= twentyFourHoursAgo
  )?.price || this.previousPrice;
  
  this.performance.daily = ((newPrice - dailyStartPrice) / dailyStartPrice) * 100;

  // Update market cap
  this.marketCap = this.currentPrice * this.circulatingSupply;

  await this.save();
  return this;
};

// Method to update match performance
playerStockSchema.methods.updateMatchPerformance = async function(matchId, stats) {
  const performanceIndex = this.matchPerformance.findIndex(
    mp => mp.matchId.toString() === matchId.toString()
  );

  if (performanceIndex === -1) {
    this.matchPerformance.push({ matchId, stats });
  } else {
    this.matchPerformance[performanceIndex].stats = stats;
  }

  // Calculate price impact based on performance
  const priceImpact = this.calculatePriceImpact(stats);
  
  if (performanceIndex === -1) {
    this.matchPerformance[this.matchPerformance.length - 1].priceImpact = priceImpact;
  } else {
    this.matchPerformance[performanceIndex].priceImpact = priceImpact;
  }

  // Update stock price based on performance
  const newPrice = this.currentPrice * (1 + (priceImpact / 100));
  await this.updatePrice(newPrice);

  return this;
};

// Helper method to calculate price impact based on performance
playerStockSchema.methods.calculatePriceImpact = function(stats) {
  let impact = 0;

  // Calculate impact based on batting performance
  if (stats.runs) {
    impact += (stats.runs / 50) * 5; // 5% increase for every 50 runs
    impact += (stats.strikeRate - 100) * 0.02; // Impact based on strike rate
  }

  // Calculate impact based on bowling performance
  if (stats.wickets) {
    impact += stats.wickets * 3; // 3% increase for each wicket
    if (stats.economy < 6) {
      impact += (6 - stats.economy) * 0.5; // Positive impact for good economy
    }
  }

  // Impact for fielding contributions
  impact += (stats.catches || 0) * 1;
  impact += (stats.runouts || 0) * 1.5;
  impact += (stats.stumpings || 0) * 2;

  return Math.min(Math.max(impact, -20), 20); // Cap impact between -20% and +20%
};

// Method to create match IPO
playerStockSchema.methods.createMatchIPO = async function(matchId, basePrice, maxPrice, availableStocks, startTime, endTime) {
  this.matchIPO.push({
    matchId,
    basePrice,
    maxPrice,
    availableStocks,
    startTime,
    endTime,
    status: 'UPCOMING'
  });

  await this.save();
  return this.matchIPO[this.matchIPO.length - 1];
};

const PlayerStock = mongoose.model('PlayerStock', playerStockSchema);

module.exports = PlayerStock;
