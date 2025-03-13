const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchId: {
    type: String,
    required: true,
    unique: true
  },
  tournament: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING'
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  venue: {
    name: String,
    city: String,
    country: String
  },
  teams: {
    team1: {
      id: String,
      name: String,
      shortName: String,
      players: [{
        playerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player'
        },
        name: String,
        role: {
          type: String,
          enum: ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']
        },
        isCaptain: {
          type: Boolean,
          default: false
        },
        isViceCaptain: {
          type: Boolean,
          default: false
        }
      }]
    },
    team2: {
      id: String,
      name: String,
      shortName: String,
      players: [{
        playerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player'
        },
        name: String,
        role: {
          type: String,
          enum: ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']
        },
        isCaptain: {
          type: Boolean,
          default: false
        },
        isViceCaptain: {
          type: Boolean,
          default: false
        }
      }]
    }
  },
  toss: {
    winner: String,
    decision: {
      type: String,
      enum: ['BAT', 'BOWL']
    }
  },
  score: {
    team1: {
      runs: {
        type: Number,
        default: 0
      },
      wickets: {
        type: Number,
        default: 0
      },
      overs: {
        type: Number,
        default: 0
      }
    },
    team2: {
      runs: {
        type: Number,
        default: 0
      },
      wickets: {
        type: Number,
        default: 0
      },
      overs: {
        type: Number,
        default: 0
      }
    }
  },
  currentInnings: {
    type: Number,
    enum: [1, 2],
    default: 1
  },
  result: {
    winner: String,
    winningMargin: Number,
    winningType: {
      type: String,
      enum: ['RUNS', 'WICKETS', 'SUPER_OVER', 'DLS', 'TIED']
    },
    description: String
  },
  liveData: {
    currentBatsmen: [{
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      name: String,
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      strikeRate: Number,
      isOnStrike: Boolean
    }],
    currentBowler: {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      name: String,
      overs: Number,
      maidens: Number,
      runs: Number,
      wickets: Number,
      economy: Number
    },
    recentBalls: [String], // Last 6 balls
    partnership: {
      runs: Number,
      balls: Number
    },
    lastWicket: {
      playerName: String,
      runs: Number,
      balls: Number,
      dismissalType: String,
      bowler: String,
      fielder: String
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
matchSchema.index({ startTime: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ matchId: 1 });
matchSchema.index({ 'teams.team1.id': 1, 'teams.team2.id': 1 });

// Method to update match score
matchSchema.methods.updateScore = async function(teamNumber, runs, wickets, overs) {
  const team = teamNumber === 1 ? 'team1' : 'team2';
  this.score[team] = {
    runs,
    wickets,
    overs
  };
  await this.save();
  return this.score;
};

// Method to update live data
matchSchema.methods.updateLiveData = async function(liveData) {
  this.liveData = { ...this.liveData, ...liveData };
  await this.save();
  return this.liveData;
};

// Method to complete match
matchSchema.methods.completeMatch = async function(result) {
  this.status = 'COMPLETED';
  this.endTime = new Date();
  this.result = result;
  await this.save();
  return this;
};

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
