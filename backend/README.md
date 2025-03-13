# Cricket Stock Exchange Backend

A Node.js/Express backend for the Cricket Stock Exchange platform, where users can trade virtual stocks of cricket players based on their real-time performance.

## Features

- **User Authentication**
  - Sign up with email verification
  - JWT-based authentication
  - Password reset functionality
  - KYC verification

- **Match Management**
  - Real-time match updates
  - Live scoring
  - Team lineups
  - Match statistics

- **Stock Trading**
  - Buy/Sell player stocks
  - Real-time price updates
  - IPO participation
  - Trading history
  - Portfolio management

- **Wallet System**
  - Add/Withdraw money
  - Transaction history
  - Bank account management
  - KYC verification

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.IO for real-time updates
- JWT for authentication
- Nodemailer for email services
- Winston for logging

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cricket-stock-exchange/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a .env file in the backend directory and configure the environment variables:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/cricket-stock-exchange
   JWT_SECRET=your-secret-key
   # Add other variables as specified in .env.example
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

### Authentication Routes

- POST `/api/auth/signup` - Register a new user
- POST `/api/auth/login` - Login user
- POST `/api/auth/forgot-password` - Request password reset
- PATCH `/api/auth/reset-password/:token` - Reset password
- GET `/api/auth/verify-email/:token` - Verify email
- GET `/api/auth/me` - Get current user profile

### Match Routes

- GET `/api/matches` - Get all matches
- GET `/api/matches/upcoming` - Get upcoming matches
- GET `/api/matches/live` - Get live matches
- GET `/api/matches/:id` - Get match details
- GET `/api/matches/:id/lineup` - Get match lineup
- GET `/api/matches/:id/stats` - Get match statistics

### Player Stock Routes

- GET `/api/player-stocks` - Get all player stocks
- GET `/api/player-stocks/:id` - Get stock details
- GET `/api/player-stocks/:id/price-history` - Get price history
- POST `/api/player-stocks/:id/buy` - Buy stock
- POST `/api/player-stocks/:id/sell` - Sell stock
- POST `/api/player-stocks/:id/ipo/participate` - Participate in IPO

### Wallet Routes

- GET `/api/wallet` - Get wallet details
- GET `/api/wallet/transactions` - Get transaction history
- POST `/api/wallet/deposit` - Add money to wallet
- POST `/api/wallet/withdraw` - Withdraw money
- POST `/api/wallet/bank-accounts` - Add bank account

## Error Handling

The API uses a centralized error handling mechanism. All errors include:
- Status code
- Error message
- Error details (in development)

Example error response:
```json
{
  "status": "error",
  "message": "Invalid credentials",
  "error": {
    "statusCode": 401,
    "status": "fail"
  }
}
```

## WebSocket Events

- `scoreUpdate` - Real-time match score updates
- `stockPriceUpdate` - Real-time stock price updates
- `matchComplete` - Match completion notification

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

## Deployment

1. Set environment variables for production
2. Build the application
3. Start the server:
   ```bash
   npm start
   ```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
