# Ya Otter Save - Developer Guide

**Project**: Ya Otter Save
**Stack**: Next.js 16, React 19, TypeScript, Stellar SDK, Tailwind CSS
**Status**: Testnet complete; mainnet pending
**Repository**: github.com/briwylde08/ya-otter-save

---

## Production Flow: Client vs Anchor Responsibilities

### On-Ramp Flow (MXN → CETES)

| Step | Client (Your App) | Anchor (Etherfuse) |
|------|-------------------|-------------------|
| 1 | Generate `customer_id` + `bank_account_id` UUIDs | - |
| 2 | Store IDs in database (keyed by wallet pubkey) | - |
| 3 | Request onboarding URL with those IDs | Returns KYC URL |
| 4 | Redirect user to Etherfuse | - |
| 5 | - | User completes KYC, binds IDs to their identity |
| 6 | Request quote (using stored IDs) | Returns quote + SPEI instructions |
| 7 | Display payment instructions | - |
| 8 | - | User pays via SPEI (outside app) |
| 9 | Poll for payment status | Receives fiat, updates status |
| 10 | - | **Signs & sends CETES to user's wallet** |
| 11 | Detect tokens arrived, show success | - |

### Off-Ramp Flow (CETES → MXN)

| Step | Client (Your App) | Anchor (Etherfuse) |
|------|-------------------|-------------------|
| 1 | Request off-ramp quote | Returns quote + `order_id` |
| 2 | Build burn tx (send CETES to issuer, memo = order_id) | - |
| 3 | **User signs transaction** | - |
| 4 | Submit tx to Stellar | - |
| 5 | - | Detects burn tx via memo match |
| 6 | - | Initiates SPEI to user's bank |
| 7 | Poll for completion | Updates status to `completed` |
| 8 | Show success | User receives MXN in bank |

**Key insight**: On-ramp = Etherfuse signs the Stellar tx. Off-ramp = User signs the Stellar tx.

---

## What We Built

A savings application that enables Mexican users to:

1. **On-ramp** MXN to CETES (Mexican Treasury Bills) via Etherfuse
2. **Swap** CETES to USDC via Stellar DEX
3. **Deposit** USDC to Blend Protocol to earn yield
4. **Withdraw** USDC (partial or full) from Blend
5. **Swap** USDC back to CETES
6. **Off-ramp** CETES to MXN via Etherfuse

### External Integrations

| Service | Purpose | Environment |
|---------|---------|-------------|
| **Stellar** | Base layer (payments, trustlines, DEX swaps) | Testnet |
| **Blend Protocol** | USDC lending pool for yield | Testnet (mocked) |
| **Etherfuse** | CETES tokenization + MXN on/off ramps | Sandbox |
| **Freighter** | Browser wallet for transaction signing | Testnet |

---

## How We Built It

### Phase 1: Project Setup & Wallet Integration (~30 min)

- Next.js 16 with App Router
- Freighter wallet integration via `@stellar/freighter-api`
- Custom `useWallet` hook for connection state, balances, and signing

### Phase 2: On-Ramp Flow (~2 hours)

- Etherfuse quote API integration
- SPEI payment instructions display
- Sandbox payment simulation endpoint
- Trustline creation for CETES asset

**Gotcha**: Etherfuse returns nested responses. The on-ramp order response is wrapped:
```json
{"onramp": {"orderId": "...", "status": "..."}}
```
Not flat as documentation suggests. Required unwrapping logic.

### Phase 3: Swap Implementation (~1.5 hours)

- Stellar DEX path payment integration
- Mock swap fallback when no DEX liquidity exists
- Trustline checks before swap execution

**How swaps work**: We use `pathPaymentStrictSend` which lets Stellar find the optimal route. There's rarely direct CETES/USDC liquidity, so Horizon's pathfinding typically returns:

```
CETES → XLM → USDC
```

XLM acts as a bridge asset because it has the deepest liquidity pools. The path is returned by Horizon's `/paths/strict-send` endpoint - we don't hardcode it.

**Gotcha**: Testnet has minimal DEX liquidity for CETES/USDC pairs. Implemented mock swap mode with realistic exchange rates for demo purposes.

### Phase 4: Blend Integration (~2 hours)

- Blend SDK integration for deposit/withdraw
- Yield accrual simulation (demo mode)
- Partial withdrawal support

**Gotcha**: Testnet Blend pools use a different USDC issuer than the DEX USDC. This is a known testnet fragmentation issue. We implemented demo mode for Blend operations since real deposits would require bridging between USDC issuers.

### Phase 5: Off-Ramp Flow (~3 hours)

Most complex phase due to multiple Etherfuse quirks:

- Quote generation for CETES → MXN
- Order creation with proper field mapping
- CETES burn transaction (send to issuer with memo)

**Gotcha**: Off-ramp response is also nested:
```json
{"offramp": {"orderId": "...", "status": "..."}}
```

**Gotcha**: Stellar text memos are limited to 28 bytes. UUIDs are 36 characters. Solution: Strip dashes and truncate to 28 characters:
```typescript
const memoText = orderId.replace(/-/g, "").slice(0, 28);
```
Etherfuse matches by sender public key + memo, so truncation is safe.

### Phase 6: Security Hardening (~2 hours)

- Zod validation on all API inputs
- Debug logging utility with sensitive data redaction
- Cookie-based session persistence for customer IDs
- Request timeouts (30s) to prevent hanging
- Polling limits (60s max) to prevent infinite loops

### Phase 7: Testing & Polish (~1 hour)

- Vitest test suite (41 tests)
- UI cleanup (removed debug panels)
- Partial withdrawal feature

---

## Gotcha Reference

### Etherfuse Gotchas

| Issue | Solution |
|-------|----------|
| Sandbox uses different domain | Use `api.sand.etherfuse.com` not production URL |
| Auth header has no "Bearer" prefix | Send API key directly: `Authorization: ${apiKey}` |
| Responses are nested under `onramp`/`offramp` keys | Unwrap: `response.onramp \|\| response` |
| Empty response body on `fiat_received` endpoint | Check `content-length` header, parse text not JSON |
| Customer ID must match across all calls | Store in cookie, reuse for quotes and orders |
| **Bank Account ID must match onboarding** | **See detailed section below - this cost us 60+ minutes** |
| Order ID field varies (`orderId`, `id`, `order_id`) | Check all variants when extracting |
| New orders have indexing delay | Use local state, don't immediately query |
| Wallet must be registered in Etherfuse dashboard | Complete onboarding flow first |

#### The Bank Account Not Found Issue (60+ minutes of debugging)

**Error**: `Bank account not found`

**What we tried (all failed)**:
- Generating random `bankAccountId` UUIDs on each request
- Registering bank accounts via API (kept asking for `presignedUrl`)
- Using `bankAccountId` from previous onboarding URLs
- Having user complete the onboarding form multiple times

**Root Cause**: Etherfuse requires **exact ID consistency**. Every quote and order call must use the exact same `customer_id` + `bank_account_id` pair that was used to generate the onboarding URL the user completed.

We kept generating NEW `bankAccountId` UUIDs on each request, so they never matched the one bound during onboarding.

**The Fix**:
1. Generate ONE `bankAccountId` UUID and save it to `.env.local`
2. Generate the onboarding URL with that specific ID
3. User completes onboarding (this binds the IDs together on Etherfuse's side)
4. Use those SAME IDs for ALL subsequent API calls - forever

```bash
# .env.local - these IDs are married forever after onboarding
ETHERFUSE_CUSTOMER_ID=abc123-your-customer-uuid
ETHERFUSE_BANK_ACCOUNT_ID=def456-your-bank-uuid  # Must match what was used in onboarding URL
```

**For Production**: Store these per-user in a database, not env vars. Each user gets their own ID pair created during their onboarding flow, and you must persist and reuse them for all that user's future transactions.

### Stellar Gotchas

| Issue | Solution |
|-------|----------|
| Text memo max 28 bytes | Truncate UUIDs: `uuid.replace(/-/g, "").slice(0, 28)` |
| Trustlines required before receiving assets | Check and prompt user to add trustline |
| Transaction polling can hang forever | Add max retry count (60 attempts) |
| Path payments need liquidity | Implement mock fallback for demo |

### Blend Gotchas

| Issue | Solution |
|-------|----------|
| Testnet USDC issuer differs from DEX | Use demo mode, document in TESTNET_GAPS.md |
| Soroban transactions need simulation first | Use `simulateTransaction` before `sendTransaction` |
| Results in stroops (7 decimals) | Divide by 10,000,000 for display |

### Next.js / React Gotchas

| Issue | Solution |
|-------|----------|
| Wallet state not shared between components | Lift state to page, pass wallet as prop |
| localStorage not available on server | Check `typeof window !== "undefined"` |
| Zod uses `.issues` not `.errors` | Access validation errors via `result.error.issues` |

---

## Production Checklist

### Environment Variables

**Currently hardcoded for testnet/sandbox:**

```bash
# .env.local (testnet)
ETHERFUSE_API_KEY=your_sandbox_key
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_CUSTOMER_ID=your_customer_uuid      # DELETE FOR PRODUCTION
ETHERFUSE_BANK_ACCOUNT_ID=your_bank_uuid      # DELETE FOR PRODUCTION

NEXT_PUBLIC_STELLAR_NETWORK=TESTNET
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CETES_ISSUER=GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4
NEXT_PUBLIC_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

### Critical Production Changes

#### 1. Remove Shared Customer/Bank IDs

**Current (Demo)**: Single `ETHERFUSE_CUSTOMER_ID` and `ETHERFUSE_BANK_ACCOUNT_ID` in env vars, shared by all users.

**Production**: Each user must have their own:
- `customerId` - Created during Etherfuse onboarding
- `bankAccountId` - Created when user registers their bank account

**Implementation**:
```typescript
// Store per-user in database, not env vars
interface UserEtherfuseProfile {
  walletPublicKey: string;  // Primary key
  customerId: string;       // From Etherfuse onboarding
  bankAccountId: string;    // From Etherfuse bank registration
  kycStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
```

The cookie-based session we implemented is a stopgap. For production:
- Store customer IDs in a database keyed by wallet public key
- Implement proper user authentication
- Handle KYC status tracking

#### 2. Update Asset Issuers

```bash
# Production issuers (verify these!)
NEXT_PUBLIC_CETES_ISSUER=<mainnet_cetes_issuer>
NEXT_PUBLIC_USDC_ISSUER=GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN  # Centre USDC
```

#### 3. Switch Network Configuration

```bash
NEXT_PUBLIC_STELLAR_NETWORK=PUBLIC
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban.stellar.org
ETHERFUSE_BASE_URL=https://api.etherfuse.com  # Production URL
```

#### 4. Enable Real Blend Integration

Remove `USE_MOCK_MODE = true` from:
- `src/components/BlendDeposit.tsx`
- `src/components/BlendWithdrawYield.tsx`

Verify Blend pool addresses for mainnet USDC.

#### 5. Add Security Measures

| Feature | Current | Production |
|---------|---------|------------|
| Rate limiting | None | Add `@upstash/ratelimit` or similar |
| CSRF protection | None | Add CSRF tokens to forms |
| CSP headers | None | Configure in `next.config.ts` |
| Audit logging | None | Log all transactions server-side |
| Error boundaries | None | Wrap components in React error boundaries |

#### 6. Database Requirements

For production, you need persistent storage for:

```typescript
// User profiles
users: {
  walletPublicKey: string;  // Primary key
  etherfuseCustomerId: string;
  etherfuseBankAccountId: string;
  kycStatus: string;
  createdAt: Date;
}

// Transaction history (currently in localStorage)
transactions: {
  id: string;
  walletPublicKey: string;
  type: 'onramp' | 'swap' | 'deposit' | 'withdraw' | 'offramp';
  amount: string;
  asset: string;
  stellarTxHash?: string;
  etherfuseOrderId?: string;
  status: string;
  createdAt: Date;
}
```

---

## Testing

```bash
# Run all tests
npm run test:run

# Run in watch mode
npm test

# With coverage
npm run test:coverage
```

Current coverage:
- **Validation**: 27 tests (amount validation, schema validation, edge cases)
- **Debug utility**: 14 tests (redaction, formatting, error handling)

---

## Architecture Notes

### Key Design Decisions

1. **Server-side API routes**: All Etherfuse calls go through `/api/anchor/*` to protect API keys
2. **Demo mode fallbacks**: When external services fail, fall back to realistic simulations
3. **Session-based customer IDs**: Cookie storage for customer ID persistence (upgrade to DB for production)
4. **Sensitive data redaction**: Debug logs automatically redact API keys, passwords, CLABEs, etc.
5. **Validation at boundaries**: Zod schemas validate all API inputs and localStorage data

### File Structure

```
src/
├── app/
│   ├── api/anchor/     # Server-side API routes for Etherfuse
│   └── page.tsx        # Main application page
├── components/         # React components
├── hooks/              # Custom React hooks (useWallet)
├── lib/
│   ├── anchor/         # Etherfuse client
│   ├── blend/          # Blend Protocol client
│   ├── stellar/        # Stellar transaction helpers
│   ├── debug.ts        # Debug logging utility
│   └── validation.ts   # Zod schemas
└── test/               # Test setup
```

---

## Development Timeline

| Phase | Time | % AI Generated |
|-------|------|----------------|
| Setup & wallet | 30 min | 95% |
| On-ramp | 2 hours | 90% |
| Swap | 1.5 hours | 95% |
| Blend | 2 hours | 95% |
| Off-ramp | 3 hours | 85% |
| Security | 2 hours | 95% |
| Testing | 1 hour | 95% |
| **Total** | **~12 hours** | **~92%** |

Human contribution: Testing flows, identifying bugs, making product decisions, providing domain knowledge.

---

## Known Limitations

1. **Testnet USDC fragmentation**: DEX and Blend use different USDC issuers on testnet
2. **No real Blend integration**: Demo mode only due to #1
3. **Single-user customer ID**: Currently uses env var, needs per-user storage
4. **No KYC flow UI**: Users must complete Etherfuse onboarding externally
5. **No webhook support**: Polling-based status updates only

See `TESTNET_GAPS.md` for detailed testnet limitations.

---

## Support

- **Stellar**: [developers.stellar.org](https://developers.stellar.org)
- **Blend Protocol**: [docs.blend.capital](https://docs.blend.capital)
- **Etherfuse**: [etherfuse.com](https://www.etherfuse.com)
