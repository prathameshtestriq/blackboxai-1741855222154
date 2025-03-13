const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Player = require('../models/Player');
const Match = require('../models/Match');
const PlayerStock = require('../models/PlayerStock');
const Wallet = require('../models/Wallet');
const config = require('../config/config');

async function seedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Player.deleteMany({}),
      Match.deleteMany({}),
      PlayerStock.deleteMany({}),
      Wallet.deleteMany({})
    ]);
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('Admin123!@#', 10);
    const admin = await User.create({
      username: 'admin',
      email: 'admin@cricketstockexchange.com',
      password: adminPassword,
      role: 'admin',
      isVerified: true
    });

    await Wallet.create({
      userId: admin._id,
      balance: 100000,
      kyc: { status: 'VERIFIED' }
    });

    console.log('Created admin user');

    // Create sample users
    const userPassword = await bcrypt.hash('User123!@#', 10);
    const users = await User.insertMany([
      {
        username: 'john_doe',
        email: 'john@example.com',
        password: userPassword,
        isVerified: true
      },
      {
        username: 'jane_smith',
        email: 'jane@example.com',
        password: userPassword,
        isVerified: true
      }
    ]);

    // Create wallets for sample users
    await Wallet.insertMany(users.map(user => ({
      userId: user._id,
      balance: 50000,
      kyc: { status: 'VERIFIED' }
    })));

    console.log('Created sample users and wallets');

    // Create players
    const players = await Player.insertMany([
      {
        name: 'Virat Kohli',
        displayName: 'V Kohli',
        dateOfBirth: new Date('1988-11-05'),
        nationality: 'India',
        role: 'BATSMAN',
        battingStyle: 'RIGHT_HANDED',
        stats: {
          batting: {
            matches: 200,
            runs: 12000,
            average: 59.5,
            strikeRate: 138.5,
            hundreds: 43,
            fifties: 62
          }
        }
      },
      {
        name: 'Rohit Sharma',
        displayName: 'R Sharma',
        dateOfBirth: new Date('1987-04-30'),
        nationality: 'India',
        role: 'BATSMAN',
        battingStyle: 'RIGHT_HANDED',
        stats: {
          batting: {
            matches: 180,
            runs: 9500,
            average: 48.5,
            strikeRate: 140.2,
            hundreds: 29,
            fifties: 43
          }
        }
      },
      {
        name: 'Jasprit Bumrah',
        displayName: 'J Bumrah',
        dateOfBirth: new Date('1993-12-06'),
        nationality: 'India',
        role: 'BOWLER',
        bowlingStyle: 'RIGHT_ARM_FAST',
        stats: {
          bowling: {
            matches: 120,
            wickets: 180,
            average: 22.5,
            economy: 6.8,
            fiveWickets: 8
          }
        }
      }
    ]);

    console.log('Created sample players');

    // Create player stocks
    await PlayerStock.insertMany(players.map(player => ({
      playerId: player._id,
      name: player.name,
      currentPrice: Math.floor(Math.random() * 1000) + 500,
      previousPrice: Math.floor(Math.random() * 1000) + 500,
      totalSupply: 1000000,
      circulatingSupply: 500000,
      tradingStatus: 'ACTIVE',
      marketCap: 1000000,
      volatilityIndex: Math.random() * 5
    })));

    console.log('Created player stocks');

    // Create upcoming match
    const upcomingMatch = await Match.create({
      matchId: 'IPL2024_M001',
      tournament: 'IPL 2024',
      status: 'UPCOMING',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
          players: players.slice(0, 1).map(player => ({
            playerId: player._id,
            name: player.name,
            role: player.role,
            isCaptain: true
          }))
        },
        team2: {
          id: 'MI',
          name: 'Mumbai Indians',
          shortName: 'MI',
          players: players.slice(1, 2).map(player => ({
            playerId: player._id,
            name: player.name,
            role: player.role,
            isCaptain: true
          }))
        }
      }
    });

    // Create IPOs for the upcoming match
    for (const player of players) {
      const stock = await PlayerStock.findOne({ playerId: player._id });
      if (stock) {
        stock.matchIPO.push({
          matchId: upcomingMatch._id,
          basePrice: stock.currentPrice * 0.8,
          maxPrice: stock.currentPrice * 1.2,
          availableStocks: 100000,
          startTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
          endTime: new Date(Date.now() + 23 * 60 * 60 * 1000),
          status: 'UPCOMING'
        });
        await stock.save();
      }
    }

    console.log('Created upcoming match and IPOs');

    // Add some stocks to user portfolios
    for (const user of users) {
      user.portfolio = players.map((player, index) => ({
        playerId: player._id,
        quantity: Math.floor(Math.random() * 100) + 50,
        averageBuyPrice: Math.floor(Math.random() * 500) + 500
      }));
      await user.save();
    }

    console.log('Added stocks to user portfolios');

    console.log('Database seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedData();
