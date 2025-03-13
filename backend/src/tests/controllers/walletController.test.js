const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const { logger } = require('../../utils/logger');

describe('Wallet Controller', () => {
  let user;
  let token;
  let wallet;

  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Test123!@#',
    isVerified: true
  };

  beforeEach(async () => {
    // Create test user
    user = await User.create(testUser);
    token = user.generateAuthToken();

    // Create wallet for user
    wallet = await Wallet.create({
      userId: user._id,
      balance: 1000, // Initial balance for testing
      kyc: {
        status: 'VERIFIED' // Set KYC as verified for testing
      },
      savedBankAccounts: [{
        accountNumber: '1234567890',
        bankName: 'Test Bank',
        ifscCode: 'TEST0001',
        accountHolderName: 'Test User',
        isVerified: true,
        isPrimary: true
      }]
    });
  });

  describe('GET /api/wallet', () => {
    it('should return wallet details', async () => {
      const res = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.wallet).toHaveProperty('balance', 1000);
      expect(res.body.data.wallet.userId.toString()).toBe(user._id.toString());
    });

    it('should return error if not authenticated', async () => {
      const res = await request(app)
        .get('/api/wallet')
        .expect(401);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('not logged in');
    });
  });

  describe('POST /api/wallet/deposit', () => {
    const depositAmount = 500;

    it('should add money to wallet', async () => {
      const res = await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: depositAmount,
          paymentMethod: 'CREDIT_CARD',
          paymentDetails: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123'
          }
        })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.balance).toBe(1500); // Initial 1000 + 500
      expect(res.body.data.transaction).toHaveProperty('type', 'DEPOSIT');
      expect(res.body.data.transaction).toHaveProperty('amount', depositAmount);
      expect(res.body.data.transaction).toHaveProperty('status', 'COMPLETED');
    });

    it('should return error for negative amount', async () => {
      const res = await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: -100,
          paymentMethod: 'CREDIT_CARD',
          paymentDetails: {}
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('must be greater than 0');
    });

    it('should return error if daily deposit limit exceeded', async () => {
      // First deposit
      await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: wallet.limits.dailyDeposit,
          paymentMethod: 'CREDIT_CARD',
          paymentDetails: {}
        });

      // Second deposit exceeding limit
      const res = await request(app)
        .post('/api/wallet/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          paymentMethod: 'CREDIT_CARD',
          paymentDetails: {}
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Daily deposit limit exceeded');
    });
  });

  describe('POST /api/wallet/withdraw', () => {
    const withdrawAmount = 500;

    it('should create withdrawal request', async () => {
      const res = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: withdrawAmount,
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Test Bank',
            ifscCode: 'TEST0001',
            accountHolderName: 'Test User'
          }
        })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.withdrawalRequest).toHaveProperty('amount', withdrawAmount);
      expect(res.body.data.withdrawalRequest).toHaveProperty('status', 'PENDING');
      expect(res.body.data.transaction).toHaveProperty('type', 'WITHDRAW');
      expect(res.body.data.transaction).toHaveProperty('status', 'PENDING');
    });

    it('should return error for insufficient balance', async () => {
      const res = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 2000, // More than wallet balance
          bankDetails: {
            accountNumber: '1234567890',
            bankName: 'Test Bank',
            ifscCode: 'TEST0001',
            accountHolderName: 'Test User'
          }
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Insufficient balance');
    });

    it('should return error for unverified bank account', async () => {
      const res = await request(app)
        .post('/api/wallet/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: withdrawAmount,
          bankDetails: {
            accountNumber: '9876543210', // Different account number
            bankName: 'Another Bank',
            ifscCode: 'TEST0002',
            accountHolderName: 'Test User'
          }
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Please use a verified bank account');
    });
  });

  describe('GET /api/wallet/transactions', () => {
    beforeEach(async () => {
      // Add some test transactions
      await wallet.addTransaction({
        type: 'DEPOSIT',
        amount: 500,
        status: 'COMPLETED'
      });
      await wallet.addTransaction({
        type: 'WITHDRAW',
        amount: 200,
        status: 'COMPLETED'
      });
    });

    it('should return transaction history', async () => {
      const res = await request(app)
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.transactions).toHaveLength(2);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should filter transactions by type', async () => {
      const res = await request(app)
        .get('/api/wallet/transactions?type=DEPOSIT')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.transactions[0]).toHaveProperty('type', 'DEPOSIT');
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/wallet/transactions?page=1&limit=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.transactions).toHaveLength(1);
      expect(res.body.data.pagination).toHaveProperty('page', 1);
      expect(res.body.data.pagination).toHaveProperty('limit', 1);
      expect(res.body.data.pagination).toHaveProperty('total', 2);
    });
  });

  describe('POST /api/wallet/bank-accounts', () => {
    const bankAccount = {
      accountNumber: '9876543210',
      bankName: 'New Test Bank',
      ifscCode: 'TEST0002',
      accountHolderName: 'Test User'
    };

    it('should add new bank account', async () => {
      const res = await request(app)
        .post('/api/wallet/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send(bankAccount)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.bankAccount).toMatchObject(bankAccount);
      expect(res.body.data.bankAccount).toHaveProperty('isVerified', false);
    });

    it('should return error for duplicate account number', async () => {
      // Try to add the same account number that was added in beforeEach
      const res = await request(app)
        .post('/api/wallet/bank-accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          accountNumber: '1234567890', // Existing account number
          bankName: 'Test Bank',
          ifscCode: 'TEST0001',
          accountHolderName: 'Test User'
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Bank account already exists');
    });
  });
});
