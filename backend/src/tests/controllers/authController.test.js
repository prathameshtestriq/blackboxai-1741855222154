const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const { logger } = require('../../utils/logger');

describe('Auth Controller', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Test123!@#',
    confirmPassword: 'Test123!@#'
  };

  describe('POST /api/auth/signup', () => {
    it('should create a new user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(201);

      // Check response structure
      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('username', testUser.username);
      expect(res.body.data.user).toHaveProperty('email', testUser.email);
      expect(res.body.data.user).not.toHaveProperty('password');

      // Check if user was created in database
      const user = await User.findOne({ email: testUser.email });
      expect(user).toBeTruthy();
      expect(user.username).toBe(testUser.username);

      // Check if wallet was created for user
      const wallet = await Wallet.findOne({ userId: user._id });
      expect(wallet).toBeTruthy();
      expect(wallet.balance).toBe(0);
    });

    it('should return error if passwords do not match', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          ...testUser,
          confirmPassword: 'wrongpassword'
        })
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body).toHaveProperty('message', 'Passwords do not match');
    });

    it('should return error if email already exists', async () => {
      // First create a user
      await User.create({
        username: 'existinguser',
        email: testUser.email,
        password: 'Password123!@#'
      });

      // Try to create another user with same email
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser)
        .expect(400);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('duplicate');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a verified user before each test
      const user = new User({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        isVerified: true
      });
      await user.save();
    });

    it('should login user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', testUser.email);
    });

    it('should return error with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Incorrect email or password');
    });

    it('should return error if user is not verified', async () => {
      // Update user to be unverified
      await User.findOneAndUpdate(
        { email: testUser.email },
        { isVerified: false }
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(401);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('verify your email');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await User.create({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        isVerified: true
      });
    });

    it('should send reset password email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.message).toContain('Password reset link sent');

      // Check if reset token was saved
      const user = await User.findOne({ email: testUser.email });
      expect(user.resetPasswordToken).toBeTruthy();
      expect(user.resetPasswordExpires).toBeTruthy();
    });

    it('should return success even if email does not exist (security)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('no user with this email');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeEach(async () => {
      // Create user and get token
      const user = await User.create({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        isVerified: true
      });

      token = user.generateAuthToken();
    });

    it('should return current user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body.data.user).toHaveProperty('email', testUser.email);
      expect(res.body.data.user).not.toHaveProperty('password');
    });

    it('should return error if not authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('not logged in');
    });
  });

  describe('PATCH /api/auth/update-password', () => {
    let token;
    const newPassword = 'NewPassword123!@#';

    beforeEach(async () => {
      // Create user and get token
      const user = await User.create({
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        isVerified: true
      });

      token = user.generateAuthToken();
    });

    it('should update user password', async () => {
      const res = await request(app)
        .patch('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: testUser.password,
          newPassword,
          confirmNewPassword: newPassword
        })
        .expect(200);

      expect(res.body).toHaveProperty('status', 'success');
      expect(res.body).toHaveProperty('token');

      // Check if password was actually updated
      const user = await User.findOne({ email: testUser.email }).select('+password');
      const isPasswordValid = await user.comparePassword(newPassword);
      expect(isPasswordValid).toBe(true);
    });

    it('should return error if current password is incorrect', async () => {
      const res = await request(app)
        .patch('/api/auth/update-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword,
          confirmNewPassword: newPassword
        })
        .expect(401);

      expect(res.body).toHaveProperty('status', 'fail');
      expect(res.body.message).toContain('Current password is incorrect');
    });
  });
});
