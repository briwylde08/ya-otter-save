/**
 * Mock Anchor Client for Testnet Demo
 *
 * This simulates the Etherfuse anchor flow for demos where we don't have
 * real API credentials. It follows the same interface and flow patterns
 * but stores state in memory and simulates token delivery.
 *
 * In a real implementation, this would be replaced with EtherfuseClient.
 */

import {
  Anchor,
  Customer,
  Quote,
  OnRampTransaction,
  OffRampTransaction,
  FiatAccount,
  KycStatus,
  CreateCustomerInput,
  GetQuoteInput,
  CreateOnRampInput,
  CreateOffRampInput,
  RegisterFiatAccountInput,
} from "./types";

// In-memory storage for demo
const customers = new Map<string, Customer>();
const quotes = new Map<string, Quote>();
const onRampTxs = new Map<string, OnRampTransaction>();
const offRampTxs = new Map<string, OffRampTransaction>();
const fiatAccounts = new Map<string, FiatAccount[]>();

// Generate random IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Simulated exchange rate: 1 CETES = ~17.5 MXN (approximate)
const CETES_MXN_RATE = 17.5;
// Simulated fee: 1% for on-ramp/off-ramp
const FEE_PERCENTAGE = 0.01;

export class MockAnchorClient implements Anchor {
  readonly name = "mock-etherfuse";

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    const customer: Customer = {
      id: generateId(),
      email: input.email,
      publicKey: input.publicKey,
      kycStatus: "approved", // Auto-approve for demo
      createdAt: new Date().toISOString(),
    };

    customers.set(customer.id, customer);
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return customers.get(customerId) || null;
  }

  async getKycUrl(customerId: string): Promise<string> {
    // Return a mock URL - in demo, KYC is auto-approved
    return `https://mock-kyc.example.com/verify/${customerId}`;
  }

  async getKycStatus(customerId: string): Promise<KycStatus> {
    const customer = customers.get(customerId);
    return customer?.kycStatus || "not_started";
  }

  async getQuote(input: GetQuoteInput): Promise<Quote> {
    const isOnRamp = input.sourceAsset === "MXN";
    const sourceAmount = parseFloat(input.sourceAmount || "0");

    // Calculate fee (1% of source amount)
    const fee = sourceAmount * FEE_PERCENTAGE;
    const amountAfterFee = sourceAmount - fee;

    let destinationAmount: number;
    if (isOnRamp) {
      // MXN -> CETES (fee deducted from MXN before conversion)
      destinationAmount = amountAfterFee / CETES_MXN_RATE;
    } else {
      // CETES -> MXN (fee deducted from CETES value in MXN)
      destinationAmount = amountAfterFee * CETES_MXN_RATE;
    }

    const quote: Quote = {
      id: generateId(),
      sourceAsset: input.sourceAsset,
      destinationAsset: input.destinationAsset,
      sourceAmount: sourceAmount.toFixed(2),
      destinationAmount: destinationAmount.toFixed(7),
      rate: isOnRamp
        ? (1 / CETES_MXN_RATE).toFixed(7)
        : CETES_MXN_RATE.toFixed(2),
      fee: isOnRamp ? fee.toFixed(2) : fee.toFixed(7), // Fee in source asset units
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
    };

    quotes.set(quote.id, quote);
    return quote;
  }

  async createOnRamp(input: CreateOnRampInput): Promise<OnRampTransaction> {
    // Try to get quote from mock store, but don't fail if not found
    // (quote might have come from real Etherfuse API)
    const quote = quotes.get(input.quoteId);

    // Use quote data if available, otherwise use defaults for demo
    const sourceAmount = quote?.sourceAmount || "1000";
    const destinationAmount = quote?.destinationAmount || "88.78";

    const tx: OnRampTransaction = {
      id: generateId(),
      customerId: input.customerId,
      status: "pending",
      sourceAmount,
      sourceAsset: "MXN",
      destinationAmount,
      destinationAsset: "CETES",
      destinationAddress: input.destinationAddress,
      paymentInstructions: {
        type: "spei",
        clabe: "012180015555555555", // Mock CLABE
        beneficiary: "Etherfuse SA de CV",
        bank: "BBVA Mexico",
        amount: sourceAmount,
        currency: "MXN",
        reference: `OTTER-${generateId().toUpperCase()}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onRampTxs.set(tx.id, tx);
    return tx;
  }

  async getOnRampTransaction(
    transactionId: string
  ): Promise<OnRampTransaction | null> {
    return onRampTxs.get(transactionId) || null;
  }

  async createOffRamp(input: CreateOffRampInput): Promise<OffRampTransaction> {
    const quote = quotes.get(input.quoteId);
    if (!quote) {
      throw new Error("Quote not found");
    }

    // input.publicKey is the Stellar address burning the CETES
    const tx: OffRampTransaction = {
      id: generateId(),
      customerId: input.customerId,
      status: "pending",
      sourceAmount: quote.sourceAmount,
      sourceAsset: quote.sourceAsset,
      destinationAmount: quote.destinationAmount,
      destinationAsset: quote.destinationAsset,
      bankAccountId: input.bankAccountId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    offRampTxs.set(tx.id, tx);
    return tx;
  }

  async getOffRampTransaction(
    transactionId: string
  ): Promise<OffRampTransaction | null> {
    return offRampTxs.get(transactionId) || null;
  }

  async registerFiatAccount(
    input: RegisterFiatAccountInput
  ): Promise<FiatAccount> {
    const account: FiatAccount = {
      id: generateId(),
      bankName: "BBVA Mexico", // Derive from CLABE in real impl
      clabe: input.clabe,
      holderName: input.holderName,
      isDefault: true,
    };

    const customerAccounts = fiatAccounts.get(input.customerId) || [];
    customerAccounts.push(account);
    fiatAccounts.set(input.customerId, customerAccounts);

    return account;
  }

  async getFiatAccounts(customerId: string): Promise<FiatAccount[]> {
    return fiatAccounts.get(customerId) || [];
  }

  // Demo helper: Simulate completing an on-ramp
  async simulateOnRampComplete(transactionId: string): Promise<void> {
    const tx = onRampTxs.get(transactionId);
    if (tx) {
      tx.status = "completed";
      tx.stellarTxHash = `mock_${generateId()}`;
      tx.updatedAt = new Date().toISOString();
      onRampTxs.set(transactionId, tx);
    }
  }

  // Demo helper: Simulate completing an off-ramp
  async simulateOffRampComplete(transactionId: string): Promise<void> {
    const tx = offRampTxs.get(transactionId);
    if (tx) {
      tx.status = "completed";
      tx.updatedAt = new Date().toISOString();
      offRampTxs.set(transactionId, tx);
    }
  }
}

// Singleton for demo use
export const mockAnchor = new MockAnchorClient();
