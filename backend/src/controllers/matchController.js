const Match = require('../models/Match');
const Player = require('../models/Player');
const PlayerStock = require('../models/PlayerStock');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

// Get all matches with filters
exports.getMatches = catchAsync(async (req, res, next) => {
  const {
    status,
    tournament,
    team,
    startDate,
    endDate,
    page = 1,
    limit = 10
  } = req.query;

  // Build query
  const query = {};

  if (status) {
    query.status = status.toUpperCase();
  }

  if (tournament) {
    query.tournament = tournament;
  }

  if (team) {
    query.$or = [
      { 'teams.team1.id': team },
      { 'teams.team2.id': team }
    ];
  }

  if (startDate || endDate) {
    query.startTime = {};
    if (startDate) query.startTime.$gte = new Date(startDate);
    if (endDate) query.startTime.$lte = new Date(endDate);
  }

  // Execute query with pagination
  const skip = (page - 1) * limit;
  const matches = await Match.find(query)
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Match.countDocuments(query);

  res.status(200).json({
    status: 'success',
    data: {
      matches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Get single match details
exports.getMatch = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      match
    }
  });
});

// Get live match updates
exports.getLiveMatchUpdates = catchAsync(async (req, res, next) => {
  const match = await Match.findOne({
    _id: req.params.id,
    status: 'LIVE'
  });

  if (!match) {
    return next(new AppError('Live match not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      match
    }
  });
});

// Update match score and stats
exports.updateMatchScore = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    teamNumber,
    runs,
    wickets,
    overs,
    currentBatsmen,
    currentBowler,
    recentBalls,
    partnership,
    lastWicket
  } = req.body;

  const match = await Match.findById(id);

  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  if (match.status !== 'LIVE') {
    return next(new AppError('Match is not live', 400));
  }

  // Update score
  await match.updateScore(teamNumber, runs, wickets, overs);

  // Update live data
  const liveData = {
    currentBatsmen,
    currentBowler,
    recentBalls,
    partnership,
    lastWicket
  };

  await match.updateLiveData(liveData);

  // Emit socket event for live updates
  req.app.get('io').to(`match_${id}`).emit('scoreUpdate', {
    matchId: id,
    score: match.score,
    liveData: match.liveData
  });

  logger.info('Match score updated', {
    matchId: id,
    teamNumber,
    runs,
    wickets,
    overs
  });

  res.status(200).json({
    status: 'success',
    data: {
      match
    }
  });
});

// Complete match and update player stats
exports.completeMatch = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { result, playerStats } = req.body;

  const match = await Match.findById(id);

  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  if (match.status !== 'LIVE') {
    return next(new AppError('Match is not live', 400));
  }

  // Update match status and result
  await match.completeMatch(result);

  // Update player stats and stock prices
  for (const playerId in playerStats) {
    const stats = playerStats[playerId];

    // Update player statistics
    const player = await Player.findById(playerId);
    if (player) {
      await player.updateStats({
        matchId: id,
        date: match.startTime,
        against: stats.against,
        ...stats
      });
    }

    // Update player stock prices based on performance
    const playerStock = await PlayerStock.findOne({ playerId });
    if (playerStock) {
      await playerStock.updateMatchPerformance(id, stats);
    }
  }

  // Emit socket event for match completion
  req.app.get('io').to(`match_${id}`).emit('matchComplete', {
    matchId: id,
    result
  });

  logger.info('Match completed', {
    matchId: id,
    result
  });

  res.status(200).json({
    status: 'success',
    data: {
      match
    }
  });
});

// Get match lineup
exports.getMatchLineup = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id)
    .select('teams.team1.players teams.team2.players');

  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      team1: match.teams.team1.players,
      team2: match.teams.team2.players
    }
  });
});

// Get match statistics
exports.getMatchStats = catchAsync(async (req, res, next) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    return next(new AppError('Match not found', 404));
  }

  // Get detailed player statistics for the match
  const playerStats = await Promise.all(
    [...match.teams.team1.players, ...match.teams.team2.players].map(async (player) => {
      const fullPlayer = await Player.findById(player.playerId);
      const recentPerformance = fullPlayer?.recentPerformances.find(
        perf => perf.matchId.toString() === match._id.toString()
      );

      return {
        playerId: player.playerId,
        name: player.name,
        role: player.role,
        team: player.team,
        stats: recentPerformance || {}
      };
    })
  );

  res.status(200).json({
    status: 'success',
    data: {
      match,
      playerStats
    }
  });
});

// Get upcoming matches
exports.getUpcomingMatches = catchAsync(async (req, res, next) => {
  const { limit = 5 } = req.query;

  const matches = await Match.find({
    status: 'UPCOMING',
    startTime: { $gt: new Date() }
  })
    .sort({ startTime: 1 })
    .limit(parseInt(limit));

  res.status(200).json({
    status: 'success',
    data: {
      matches
    }
  });
});

// Get live matches
exports.getLiveMatches = catchAsync(async (req, res, next) => {
  const matches = await Match.find({ status: 'LIVE' });

  res.status(200).json({
    status: 'success',
    data: {
      matches
    }
  });
});

// Get completed matches
exports.getCompletedMatches = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const skip = (page - 1) * limit;
  const matches = await Match.find({ status: 'COMPLETED' })
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Match.countDocuments({ status: 'COMPLETED' });

  res.status(200).json({
    status: 'success',
    data: {
      matches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});
