const nodemailer = require('nodemailer');
const config = require('../config/config');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass
      }
    });
  }

  // Send verification email
  async sendVerificationEmail(user, verificationToken) {
    const verificationUrl = `${config.clientUrl}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: config.email.from,
      to: user.email,
      subject: 'Cricket Stock Exchange - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Welcome to Cricket Stock Exchange!</h2>
          <p>Hello ${user.username},</p>
          <p>Thank you for registering with Cricket Stock Exchange. To complete your registration, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #3498db; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #3498db;">${verificationUrl}</p>
          
          <p>This verification link will expire in 24 hours.</p>
          
          <p>If you didn't create an account with Cricket Stock Exchange, please ignore this email.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated message, please do not reply to this email.
            If you need assistance, please contact our support team.
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${config.clientUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: config.email.from,
      to: user.email,
      subject: 'Cricket Stock Exchange - Password Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Password Reset Request</h2>
          <p>Hello ${user.username},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #e74c3c; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #e74c3c;">${resetUrl}</p>
          
          <p>This password reset link will expire in 1 hour.</p>
          
          <p>If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account's security.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated message, please do not reply to this email.
            If you need assistance, please contact our support team.
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send withdrawal confirmation email
  async sendWithdrawalConfirmationEmail(user, withdrawalDetails) {
    const mailOptions = {
      from: config.email.from,
      to: user.email,
      subject: 'Cricket Stock Exchange - Withdrawal Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Withdrawal Confirmation</h2>
          <p>Hello ${user.username},</p>
          <p>Your withdrawal request has been processed successfully.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Transaction Details:</h3>
            <p><strong>Amount:</strong> ₹${withdrawalDetails.amount}</p>
            <p><strong>Bank Account:</strong> XXXX${withdrawalDetails.bankAccount.slice(-4)}</p>
            <p><strong>Transaction ID:</strong> ${withdrawalDetails.transactionId}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p>The amount will be credited to your bank account within 2-3 business days.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated message, please do not reply to this email.
            If you need assistance, please contact our support team.
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send stock purchase confirmation email
  async sendStockPurchaseConfirmationEmail(user, purchaseDetails) {
    const mailOptions = {
      from: config.email.from,
      to: user.email,
      subject: 'Cricket Stock Exchange - Stock Purchase Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Stock Purchase Confirmation</h2>
          <p>Hello ${user.username},</p>
          <p>Your stock purchase has been completed successfully.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2c3e50; margin-top: 0;">Transaction Details:</h3>
            <p><strong>Player:</strong> ${purchaseDetails.playerName}</p>
            <p><strong>Quantity:</strong> ${purchaseDetails.quantity}</p>
            <p><strong>Price per Share:</strong> ₹${purchaseDetails.pricePerShare}</p>
            <p><strong>Total Amount:</strong> ₹${purchaseDetails.totalAmount}</p>
            <p><strong>Transaction ID:</strong> ${purchaseDetails.transactionId}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
          
          <p>You can view your updated portfolio in your account dashboard.</p>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated message, please do not reply to this email.
            If you need assistance, please contact our support team.
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }

  // Send KYC verification status email
  async sendKYCStatusEmail(user, status, remarks) {
    const mailOptions = {
      from: config.email.from,
      to: user.email,
      subject: `Cricket Stock Exchange - KYC Verification ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">KYC Verification Update</h2>
          <p>Hello ${user.username},</p>
          
          ${status === 'VERIFIED' ? `
            <p style="color: #27ae60;">Your KYC verification has been completed successfully!</p>
            <p>You now have full access to all features of Cricket Stock Exchange.</p>
          ` : `
            <p style="color: #e74c3c;">Your KYC verification was not successful.</p>
            <p><strong>Reason:</strong> ${remarks}</p>
            <p>Please update and resubmit your KYC documents to continue using all features.</p>
          `}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.clientUrl}/dashboard/kyc" 
               style="background-color: #3498db; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      font-weight: bold;">
              View KYC Status
            </a>
          </div>
          
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated message, please do not reply to this email.
            If you need assistance, please contact our support team.
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
  }
}

module.exports = new EmailService();
