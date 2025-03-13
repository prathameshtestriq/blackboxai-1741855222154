const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Wallet balance cannot be negative']
  },
  transactions: [{
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAW', 'STOCK_BUY', 'STOCK_SELL', 'IPO_INVESTMENT', 'REFUND'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'PENDING'
    },
    stockDetails: {
      stockId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlayerStock'
      },
      quantity: Number,
      pricePerUnit: Number
    },
    paymentDetails: {
      paymentId: String,
      paymentMethod: {
        type: String,
        enum: ['CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'UPI', 'WALLET']
      },
      paymentStatus: String,
      paymentResponse: mongoose.Schema.Types.Mixed
    },
    bankDetails: {
      accountNumber: String,
      bankName: String,
      ifscCode: String,
      accountHolderName: String
    },
    description: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    reference: String
  }],
  withdrawalRequests: [{
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
      default: 'PENDING'
    },
    bankDetails: {
      accountNumber: {
        type: String,
        required: true
      },
      bankName: {
        type: String,
        required: true
      },
      ifscCode: {
        type: String,
        required: true
      },
      accountHolderName: {
        type: String,
        required: true
      }
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: Date,
    remarks: String,
    reference: String
  }],
  savedBankAccounts: [{
    accountNumber: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    accountHolderName: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  limits: {
    dailyDeposit: {
      type: Number,
      default: 50000
    },
    dailyWithdrawal: {
      type: Number,
      default: 25000
    },
    minDeposit: {
      type: Number,
      default: 100
    },
    minWithdrawal: {
      type: Number,
      default: 100
    }
  },
  kyc: {
    status: {
      type: String,
      enum: ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'],
      default: 'NOT_SUBMITTED'
    },
    documents: [{
      type: {
        type: String,
        enum: ['PAN', 'AADHAR', 'PASSPORT']
      },
      number: String,
      verificationStatus: {
        type: String,
        enum: ['PENDING', 'VERIFIED', 'REJECTED'],
        default: 'PENDING'
      },
      remarks: String
    }]
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
walletSchema.index({ userId: 1 });
walletSchema.index({ 'transactions.timestamp': 1 });
walletSchema.index({ 'transactions.status': 1 });
walletSchema.index({ 'withdrawalRequests.status': 1 });

// Method to add transaction
walletSchema.methods.addTransaction = async function(transactionData) {
  const transaction = {
    ...transactionData,
    timestamp: new Date(),
    reference: generateTransactionReference()
  };

  this.transactions.push(transaction);
  
  if (transaction.status === 'COMPLETED') {
    if (['DEPOSIT', 'STOCK_SELL', 'REFUND'].includes(transaction.type)) {
      this.balance += transaction.amount;
    } else if (['WITHDRAW', 'STOCK_BUY', 'IPO_INVESTMENT'].includes(transaction.type)) {
      if (this.balance < transaction.amount) {
        throw new Error('Insufficient balance');
      }
      this.balance -= transaction.amount;
    }
  }

  await this.save();
  return transaction;
};

// Method to process withdrawal request
walletSchema.methods.processWithdrawalRequest = async function(requestId, status, remarks) {
  const request = this.withdrawalRequests.id(requestId);
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  request.status = status;
  request.processedAt = new Date();
  request.remarks = remarks;

  if (status === 'APPROVED') {
    // Create a pending withdrawal transaction
    await this.addTransaction({
      type: 'WITHDRAW',
      amount: request.amount,
      status: 'PENDING',
      bankDetails: request.bankDetails,
      description: `Withdrawal to bank account ${request.bankDetails.accountNumber}`
    });
  }

  await this.save();
  return request;
};

// Method to add bank account
walletSchema.methods.addBankAccount = async function(bankDetails) {
  // If this is the first bank account, make it primary
  if (this.savedBankAccounts.length === 0) {
    bankDetails.isPrimary = true;
  }

  this.savedBankAccounts.push(bankDetails);
  await this.save();
  return bankDetails;
};

// Method to verify KYC document
walletSchema.methods.verifyKYCDocument = async function(documentType, status, remarks) {
  const document = this.kyc.documents.find(doc => doc.type === documentType);
  if (!document) {
    throw new Error('Document not found');
  }

  document.verificationStatus = status;
  document.remarks = remarks;

  // Update overall KYC status if all documents are verified
  if (status === 'VERIFIED' && 
      this.kyc.documents.every(doc => doc.verificationStatus === 'VERIFIED')) {
    this.kyc.status = 'VERIFIED';
  }

  await this.save();
  return document;
};

// Helper function to generate transaction reference
function generateTransactionReference() {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
