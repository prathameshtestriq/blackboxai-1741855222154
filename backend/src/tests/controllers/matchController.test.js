const request = require('supertest');
const app = require('../../app');
const Match = require('../../models/Match');
const Player = require('../../models/Player');
const PlayerStock = require('../../models/PlayerStock');
const User = require('../../models/User');
const { logger } = require('../../utils/logger');

describe('Match Controller', () => {
  let user;
  let token;
  let match;
  let player1;
  let player2;

  const testUser = {
    username: 'admin',
    email: 'admin@example.com',
    password: 'Admin123!@#',
    isVerified: true,
    role: 'admin'
  };

  beforeEach(async () => {
    // Create admin user
    user = await User.create(testUser);
    token = user.generateAuthToken();

    // Create test players
    player1 = await Player.create({
      name: 'Virat Kohli',
      displayName: 'V Kohli',
      role: 'BATSMAN',
      battingStyle: 'RIGHT_HANDED',
      nationality: 'India'
    });

    player2 = await Player.create({
      name: 'Rohit Sharma',
      displayName: 'R Sharma',
      role: 'BATSMAN',
      battingStyle: 'RIGHT_HANDED',
      nationality: 'India'
    });

    // Create test match
    match = await Match.create({
      matchId: 'IPL2024_M001',
      tournament: 'IPL 2024',
      status: 'UPCOMING',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      venue: {
        name: 'M. Chinnaswamy Stadium',
        city: 'Bangalore',
        country: 'India'
      },
      teams: {
        team1: {
          id: 'RCB',
          name: 'Royal Challengers Bangalore',
          shortName: 'RCB',
          players: [{
            playerId: player1._id,
            name: player1.name,
            role: player1.role,
            isCaptain: true
          }]
        },
        team2: {
          id: 'MI',
          name: 'Mumbai Indians',
          shortName: 'MI',
          players: [{
            playerId: player2._id,
            name: player2.name,
            role: player2.role,
            isCaptain: true
          }]
        }
      }
    });
  });

  describe('GET /api/matches', () => {
    it('should return all matches with pagination', async () => {
      const res = await request(app)
        .get('/api/matches')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter matches by status', async () => {
      const res = await request(app)
        .get('/api/matches?status=UPCOMING')
        .expect(200);

      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].status).toBe('UPCOMING');
    });

    it('should filter matches by tournament', async () => {
      const res = await request(app)
        .get('/api/matches?tournament=IPL 2024')
        .expect(200);

      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].tournament).toBe('IPL 2024');
    });

    it('should filter matches by team', async () => {
      const res = await request(app)
        .get('/api/matches?team=RCB')
        .expect(200);

      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].teams.team1.id).toBe('RCB');
    });
  });

  describe('GET /api/matches/:id', () => {
    it('should return match details', async () => {
      const res = await request(app)
        .get(`/api/matches/${match._id}`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.match).toHaveProperty('matchId', 'IPL2024_M001');
      expect(res.body.data.match.teams.team1).toHaveProperty('name', 'Royal Challengers Bangalore');
    });

    it('should return error for non-existent match', async () => {
      const res = await request(app)
        .get('/api/matches/507f1f77bcf86cd799439099')
        .expect(404);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Match not found');
    });
  });

  describe('GET /api/matches/:id/lineup', () => {
    it('should return match lineup', async () => {
      const res = await request(app)
        .get(`/api/matches/${match._id}/lineup`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.team1).toHaveLength(1);
      expect(res.body.data.team2).toHaveLength(1);
      expect(res.body.data.team1[0]).toHaveProperty('name', 'Virat Kohli');
      expect(res.body.data.team2[0]).toHaveProperty('name', 'Rohit Sharma');
    });
  });

  describe('PATCH /api/matches/:id/score (Admin only)', () => {
    beforeEach(async () => {
      // Update match status to LIVE
      await Match.findByIdAndUpdate(match._id, { status: 'LIVE' });
    });

    it('should update match score', async () => {
      const scoreUpdate = {
        teamNumber: 1,
        runs: 100,
        wickets: 2,
        overs: 12.4,
        currentBatsmen: [
          {
            playerId: player1._id,
            name: player1.name,
            runs: 60,
            balls: 40,
            fours: 6,
            sixes: 2,
            strikeRate: 150,
            isOnStrike: true
          }
        ],
        currentBowler: {
          playerId: player2._id,
          name: player2.name,
          overs: 4,
          maidens: 0,
          runs: 32,
          wickets: 1,
          economy: 8
        },
        recentBalls: ['1', '4', '0', 'W', '2', '6']
      };

      const res = await request(app)
        .patch(`/api/matches/${match._id}/score`)
        .set('Authorization', `Bearer ${token}`)
        .send(scoreUpdate)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.match.score.team1).toMatchObject({
        runs: 100,
        wickets: 2,
        overs: 12.4
      });
      expect(res.body.data.match.liveData.currentBatsmen[0]).toHaveProperty('runs', 60);
    });

    it('should return error for non-admin user', async () => {
      // Create non-admin user
      const regularUser = await User.create({
        username: 'regular',
        email: 'regular@example.com',
        password: 'Regular123!@#',
        isVerified: true
      });
      const regularToken = regularUser.generateAuthToken();

      const res = await request(app)
        .patch(`/api/matches/${match._id}/score`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ teamNumber: 1, runs: 100 })
        .expect(403);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('do not have permission');
    });
  });

  describe('PATCH /api/matches/:id/complete (Admin only)', () => {
    beforeEach(async () => {
      // Update match status to LIVE and create player stocks
      await Match.findByIdAndUpdate(match._id, { status: 'LIVE' });
      await PlayerStock.create({
        playerId: player1._id,
        name: player1.name,
        currentPrice: 1000,
        totalSupply: 1000000,
        circulatingSupply: 500000,
        tradingStatus: 'ACTIVE'
      });
    });

    it('should complete match and update player stats', async () => {
      const matchResult = {
        winner: 'RCB',
        winningMargin: 45,
        winningType: 'RUNS',
        description: 'RCB won by 45 runs'
      };

      const playerStats = {
        [player1._id]: {
          batting: {
            runs: 82,
            balls: 54,
            fours: 8,
            sixes: 4,
            notOut: true
          },
          fielding: {
            catches: 1
          }
        }
      };

      const res = await request(app)
        .patch(`/api/matches/${match._id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ result: matchResult, playerStats })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.match.status).toBe('COMPLETED');
      expect(res.body.data.match.result).toMatchObject(matchResult);

      // Check if player stats were updated
      const updatedPlayer = await Player.findById(player1._id);
      expect(updatedPlayer.stats.batting.runs).toBe(82);

      // Check if player stock price was updated
      const updatedStock = await PlayerStock.findOne({ playerId: player1._id });
      expect(updatedStock.currentPrice).toBeGreaterThan(1000); // Price should increase after good performance
    });
  });

  describe('GET /api/matches/upcoming', () => {
    it('should return upcoming matches', async () => {
      const res = await request(app)
        .get('/api/matches/upcoming')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].status).toBe('UPCOMING');
    });
  });

  describe('GET /api/matches/live', () => {
    it('should return live matches', async () => {
      // Update match status to LIVE
      await Match.findByIdAndUpdate(match._id, { status: 'LIVE' });

      const res = await request(app)
        .get('/api/matches/live')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].status).toBe('LIVE');
    });
  });
});
