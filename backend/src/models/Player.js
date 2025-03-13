const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: Date,
  nationality: String,
  role: {
    type: String,
    enum: ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'],
    required: true
  },
  battingStyle: {
    type: String,
    enum: ['RIGHT_HANDED', 'LEFT_HANDED']
  },
  bowlingStyle: {
    type: String,
    enum: [
      'RIGHT_ARM_FAST',
      'RIGHT_ARM_MEDIUM_FAST',
      'RIGHT_ARM_MEDIUM',
      'RIGHT_ARM_OFF_BREAK',
      'RIGHT_ARM_LEG_BREAK',
      'LEFT_ARM_FAST',
      'LEFT_ARM_MEDIUM_FAST',
      'LEFT_ARM_MEDIUM',
      'LEFT_ARM_ORTHODOX',
      'LEFT_ARM_CHINAMAN',
      'NONE'
    ]
  },
  profileImage: {
    type: String,
    default: 'default-player.png'
  },
  teams: [{
    teamId: String,
    teamName: String,
    from: Date,
    to: Date,
    isCurrent: {
      type: Boolean,
      default: false
    }
  }],
  stats: {
    batting: {
      matches: {
        type: Number,
        default: 0
      },
      innings: {
        type: Number,
        default: 0
      },
      runs: {
        type: Number,
        default: 0
      },
      balls: {
        type: Number,
        default: 0
      },
      highestScore: {
        type: Number,
        default: 0
      },
      average: {
        type: Number,
        default: 0
      },
      strikeRate: {
        type: Number,
        default: 0
      },
      notOuts: {
        type: Number,
        default: 0
      },
      hundreds: {
        type: Number,
        default: 0
      },
      fifties: {
        type: Number,
        default: 0
      },
      fours: {
        type: Number,
        default: 0
      },
      sixes: {
        type: Number,
        default: 0
      }
    },
    bowling: {
      matches: {
        type: Number,
        default: 0
      },
      innings: {
        type: Number,
        default: 0
      },
      balls: {
        type: Number,
        default: 0
      },
      runs: {
        type: Number,
        default: 0
      },
      wickets: {
        type: Number,
        default: 0
      },
      bestBowling: {
        wickets: {
          type: Number,
          default: 0
        },
        runs: {
          type: Number,
          default: 0
        }
      },
      average: {
        type: Number,
        default: 0
      },
      economy: {
        type: Number,
        default: 0
      },
      strikeRate: {
        type: Number,
        default: 0
      },
      fiveWickets: {
        type: Number,
        default: 0
      }
    },
    fielding: {
      catches: {
        type: Number,
        default: 0
      },
      stumpings: {
        type: Number,
        default: 0
      },
      runOuts: {
        type: Number,
        default: 0
      }
    }
  },
  recentPerformances: [{
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    date: Date,
    against: String,
    batting: {
      runs: Number,
      balls: Number,
      fours: Number,
      sixes: Number,
      strikeRate: Number,
      dismissal: String
    },
    bowling: {
      overs: Number,
      maidens: Number,
      runs: Number,
      wickets: Number,
      economy: Number
    },
    fielding: {
      catches: Number,
      stumpings: Number,
      runOuts: Number
    }
  }],
  achievements: [{
    title: String,
    description: String,
    date: Date,
    category: {
      type: String,
      enum: ['BATTING', 'BOWLING', 'FIELDING', 'GENERAL']
    }
  }],
  status: {
    type: String,
    enum: ['ACTIVE', 'RETIRED', 'INJURED', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  rankings: {
    batting: {
      test: Number,
      odi: Number,
      t20: Number
    },
    bowling: {
      test: Number,
      odi: Number,
      t20: Number
    },
    allRounder: {
      test: Number,
      odi: Number,
      t20: Number
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
playerSchema.index({ name: 1 });
playerSchema.index({ role: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ 'teams.teamId': 1 });

// Method to update player statistics
playerSchema.methods.updateStats = async function(matchStats) {
  // Update batting stats
  if (matchStats.batting) {
    const batting = this.stats.batting;
    batting.matches += 1;
    batting.innings += matchStats.batting.innings ? 1 : 0;
    batting.runs += matchStats.batting.runs || 0;
    batting.balls += matchStats.batting.balls || 0;
    batting.notOuts += matchStats.batting.notOut ? 1 : 0;
    batting.fours += matchStats.batting.fours || 0;
    batting.sixes += matchStats.batting.sixes || 0;

    // Update highest score
    if ((matchStats.batting.runs || 0) > batting.highestScore) {
      batting.highestScore = matchStats.batting.runs;
    }

    // Update hundreds and fifties
    if (matchStats.batting.runs >= 100) {
      batting.hundreds += 1;
    } else if (matchStats.batting.runs >= 50) {
      batting.fifties += 1;
    }

    // Calculate average and strike rate
    batting.average = batting.innings > 0 ? 
      batting.runs / (batting.innings - batting.notOuts) : 0;
    batting.strikeRate = batting.balls > 0 ? 
      (batting.runs / batting.balls) * 100 : 0;
  }

  // Update bowling stats
  if (matchStats.bowling) {
    const bowling = this.stats.bowling;
    bowling.matches += 1;
    bowling.innings += matchStats.bowling.overs ? 1 : 0;
    bowling.balls += Math.floor(matchStats.bowling.overs) * 6 + 
      (matchStats.bowling.overs % 1) * 10;
    bowling.runs += matchStats.bowling.runs || 0;
    bowling.wickets += matchStats.bowling.wickets || 0;

    // Update best bowling
    if ((matchStats.bowling.wickets || 0) > bowling.bestBowling.wickets ||
        ((matchStats.bowling.wickets || 0) === bowling.bestBowling.wickets &&
         (matchStats.bowling.runs || 0) < bowling.bestBowling.runs)) {
      bowling.bestBowling.wickets = matchStats.bowling.wickets;
      bowling.bestBowling.runs = matchStats.bowling.runs;
    }

    // Update five wickets
    if (matchStats.bowling.wickets >= 5) {
      bowling.fiveWickets += 1;
    }

    // Calculate average, economy, and strike rate
    bowling.average = bowling.wickets > 0 ? 
      bowling.runs / bowling.wickets : 0;
    bowling.economy = bowling.balls > 0 ? 
      (bowling.runs / bowling.balls) * 6 : 0;
    bowling.strikeRate = bowling.wickets > 0 ? 
      bowling.balls / bowling.wickets : 0;
  }

  // Update fielding stats
  if (matchStats.fielding) {
    const fielding = this.stats.fielding;
    fielding.catches += matchStats.fielding.catches || 0;
    fielding.stumpings += matchStats.fielding.stumpings || 0;
    fielding.runOuts += matchStats.fielding.runOuts || 0;
  }

  // Add to recent performances
  this.recentPerformances.unshift({
    matchId: matchStats.matchId,
    date: matchStats.date,
    against: matchStats.against,
    batting: matchStats.batting,
    bowling: matchStats.bowling,
    fielding: matchStats.fielding
  });

  // Keep only last 10 performances
  if (this.recentPerformances.length > 10) {
    this.recentPerformances = this.recentPerformances.slice(0, 10);
  }

  await this.save();
  return this;
};

// Method to add achievement
playerSchema.methods.addAchievement = async function(achievement) {
  this.achievements.push({
    ...achievement,
    date: achievement.date || new Date()
  });
  await this.save();
  return this.achievements;
};

// Method to update player status
playerSchema.methods.updateStatus = async function(newStatus) {
  this.status = newStatus;
  await this.save();
  return this;
};

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
