const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const emailService = require('../utils/emailService');
const { logger } = require('../utils/logger');
const config = require('../config/config');

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// Create and send token response
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: user.getPublicProfile()
    }
  });
};

// Register new user
exports.signup = catchAsync(async (req, res, next) => {
  const { username, email, password, confirmPassword } = req.body;

  // Validate password match
  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  // Create verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  // Create user
  const user = await User.create({
    username,
    email,
    password,
    verificationToken,
    verificationTokenExpires
  });

  // Create wallet for user
  const wallet = await Wallet.create({
    userId: user._id,
    balance: 0
  });

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user, verificationToken);
    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error('Error sending verification email', { error, userId: user._id });
    return next(new AppError('Error sending verification email. Please try again.', 500));
  }

  createSendToken(user, 201, res);
});

// Verify email
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired verification token', 400));
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  createSendToken(user, 200, res);
});

// Login user
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    logger.warn('Failed login attempt', { email });
    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if email is verified
  if (!user.isVerified) {
    return next(new AppError('Please verify your email address to login', 401));
  }

  logger.info('User logged in successfully', { userId: user._id });
  createSendToken(user, 200, res);
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Get user by email
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('There is no user with this email address', 404));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour

  await user.save();

  // Send reset email
  try {
    await emailService.sendPasswordResetEmail(user, resetToken);
    logger.info('Password reset email sent', { userId: user._id });

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to email'
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.error('Error sending password reset email', { error, userId: user._id });
    return next(new AppError('Error sending password reset email. Please try again.', 500));
  }
});

// Reset password
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // Validate password match
  if (password !== confirmPassword) {
    return next(new AppError('Passwords do not match', 400));
  }

  // Get user by reset token
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired reset token', 400));
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  logger.info('Password reset successful', { userId: user._id });
  createSendToken(user, 200, res);
});

// Update password
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;

  // Validate password match
  if (newPassword !== confirmNewPassword) {
    return next(new AppError('New passwords do not match', 400));
  }

  // Get user with password
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.info('Password updated successfully', { userId: user._id });
  createSendToken(user, 200, res);
});

// Get current user
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({
    status: 'success',
    data: {
      user: user.getPublicProfile()
    }
  });
});

// Update user details
exports.updateMe = catchAsync(async (req, res, next) => {
  const { username } = req.body;

  // Create filtered object with allowed fields
  const filteredBody = {
    username
  };

  const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: user.getPublicProfile()
    }
  });
});

// Delete account
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Resend verification email
exports.resendVerificationEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new AppError('There is no user with this email address', 404));
  }

  if (user.isVerified) {
    return next(new AppError('Email is already verified', 400));
  }

  // Generate new verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = verificationToken;
  user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  await user.save();

  // Send verification email
  try {
    await emailService.sendVerificationEmail(user, verificationToken);
    logger.info('Verification email resent', { userId: user._id });

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent'
    });
  } catch (error) {
    logger.error('Error resending verification email', { error, userId: user._id });
    return next(new AppError('Error sending verification email. Please try again.', 500));
  }
});
