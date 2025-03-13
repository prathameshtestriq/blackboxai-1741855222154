const nodemailer = require('nodemailer');
const emailService = require('../../utils/emailService');
const { logger } = require('../../utils/logger');

jest.mock('nodemailer');
jest.mock('winston', () => ({
  format: {
    timestamp: jest.fn().mockReturnValue(jest.fn()),
    colorize: jest.fn().mockReturnValue(jest.fn()),
    printf: jest.fn().mockReturnValue(jest.fn()),
    combine: jest.fn().mockReturnValue(jest.fn())
  },
  createLogger: jest.fn().mockReturnValue({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    debug: jest.fn()
  }),
  addColors: jest.fn(),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('Utils', () => {
  describe('EmailService', () => {
    const mockUser = {
      username: 'testuser',
      email: 'test@example.com'
    };

    beforeEach(() => {
      nodemailer.createTransport.mockClear();
      nodemailer.createTransport().sendMail.mockClear();
    });

    it('should send verification email', async () => {
      const verificationToken = 'test-verification-token';
      
      await emailService.sendVerificationEmail(mockUser, verificationToken);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Verification'),
          html: expect.stringContaining(verificationToken)
        })
      );
    });

    it('should send password reset email', async () => {
      const resetToken = 'test-reset-token';
      
      await emailService.sendPasswordResetEmail(mockUser, resetToken);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Password Reset'),
          html: expect.stringContaining(resetToken)
        })
      );
    });

    it('should send withdrawal confirmation email', async () => {
      const withdrawalDetails = {
        amount: 1000,
        bankAccount: '****1234',
        transactionId: 'TXN123'
      };
      
      await emailService.sendWithdrawalConfirmationEmail(mockUser, withdrawalDetails);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Withdrawal Confirmation'),
          html: expect.stringContaining(withdrawalDetails.transactionId)
        })
      );
    });

    it('should send stock purchase confirmation email', async () => {
      const purchaseDetails = {
        playerName: 'Virat Kohli',
        quantity: 5,
        pricePerShare: 1000,
        totalAmount: 5000,
        transactionId: 'TXN123'
      };
      
      await emailService.sendStockPurchaseConfirmationEmail(mockUser, purchaseDetails);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Stock Purchase Confirmation'),
          html: expect.stringContaining(purchaseDetails.transactionId)
        })
      );
    });

    it('should send KYC verification status email', async () => {
      const status = 'VERIFIED';
      const remarks = 'All documents verified successfully';
      
      await emailService.sendKYCStatusEmail(mockUser, status, remarks);

      expect(nodemailer.createTransport().sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('KYC Verification'),
          html: expect.stringContaining(status)
        })
      );
    });

    it('should handle email sending errors', async () => {
      const error = new Error('SMTP error');
      nodemailer.createTransport().sendMail.mockRejectedValueOnce(error);

      await expect(
        emailService.sendVerificationEmail(mockUser, 'token')
      ).rejects.toThrow(error);
    });
  });

  describe('Logger', () => {
    const testError = new Error('Test error');
    const testMeta = { userId: '123', action: 'test' };

    it('should log error messages', () => {
      logger.error('Error occurred', testError);
      expect(logger.logger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({ meta: testError })
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', testMeta);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Warning message',
        expect.objectContaining({ meta: testMeta })
      );
    });

    it('should log info messages', () => {
      logger.info('Info message', testMeta);
      expect(logger.logger.info).toHaveBeenCalledWith(
        'Info message',
        expect.objectContaining({ meta: testMeta })
      );
    });

    it('should log HTTP requests', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/test',
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent'
        }
      };

      logger.logAPIRequest(req, testMeta);
      expect(logger.logger.http).toHaveBeenCalledWith(
        'GET /api/test',
        expect.objectContaining({
          meta: expect.objectContaining({
            ip: '127.0.0.1',
            userAgent: 'test-agent'
          })
        })
      );
    });

    it('should log API responses', () => {
      const req = {
        method: 'POST',
        originalUrl: '/api/test',
        ip: '127.0.0.1'
      };
      const res = { statusCode: 200 };
      const responseTime = 100;

      logger.logAPIResponse(req, res, responseTime, testMeta);
      expect(logger.logger.http).toHaveBeenCalledWith(
        'POST /api/test 200 100ms',
        expect.objectContaining({
          meta: expect.objectContaining({
            statusCode: 200,
            responseTime: 100
          })
        })
      );
    });

    it('should log errors with stack trace', () => {
      const req = {
        method: 'GET',
        originalUrl: '/api/test',
        user: { id: '123' }
      };

      logger.logError(testError, req, testMeta);
      expect(logger.logger.error).toHaveBeenCalledWith(
        testError.message,
        expect.objectContaining({
          meta: expect.objectContaining({
            stack: testError.stack,
            userId: '123',
            url: '/api/test',
            method: 'GET'
          })
        })
      );
    });

    it('should log database operations', () => {
      const operation = 'find';
      const collection = 'users';
      const query = { email: 'test@example.com' };
      const duration = 50;

      logger.logDBOperation(operation, collection, query, duration, testMeta);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'DB find on users took 50ms',
        expect.objectContaining({
          meta: expect.objectContaining({
            operation,
            collection,
            query,
            duration
          })
        })
      );
    });

    it('should log authentication events', () => {
      const type = 'login';
      const userId = '123';
      const success = true;

      logger.logAuthEvent(type, userId, success, testMeta);
      expect(logger.logger.info).toHaveBeenCalledWith(
        'Auth login - User: 123 - Success: true',
        expect.objectContaining({
          meta: expect.objectContaining({
            type,
            userId,
            success
          })
        })
      );
    });

    it('should log trade events', () => {
      const tradeDetails = {
        userId: '123',
        stockId: '456',
        type: 'BUY',
        quantity: 5,
        price: 1000
      };

      logger.logTradeEvent(
        tradeDetails.userId,
        tradeDetails.stockId,
        tradeDetails.type,
        tradeDetails.quantity,
        tradeDetails.price,
        testMeta
      );
      expect(logger.logger.info).toHaveBeenCalledWith(
        'Trade BUY - User: 123 - Stock: 456 - Quantity: 5 - Price: 1000',
        expect.objectContaining({
          meta: expect.objectContaining(tradeDetails)
        })
      );
    });
  });
});
