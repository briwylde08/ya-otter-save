# Ya Otter Pay Me Back - Implementation Plan

## Research Summary

### Blend Protocol Integration
**Source**: [Blend Integration Docs](https://docs.blend.capital/tech-docs/integrations/integrate-pool)

**Key Points:**
- SDK: `@blend-capital/blend-sdk`
- Core function: `PoolContract.submit()` with request types: `SupplyCollateral`, `WithdrawCollateral`, `Borrow`, `Repay`
- Position tokens: bTokens (collateral) and dTokens (debt)
- Testnet RPC: `https://soroban-testnet.stellar.org`
- Testnet USDC Issuer: `GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56`
- Pool addresses: Must be discovered from testnet.blend.capital or API

**Integration Pattern:**
```
Pool.load(network, poolId) → get reserves, config
Pool.loadUser(address) → get positions
PoolContract.submit(requests) → returns XDR operation
TransactionBuilder → simulate → sign → submit
```

### Etherfuse Anchor Integration
**Source**: [regional-starter-pack](https://github.com/elliotfriend/regional-starter-pack)

**Key Points:**
- Sandbox URL: `https://api.sand.etherfuse.com`
- Asset: CETES (Mexican government bonds)
- Mainnet CETES Issuer: `GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC`

**On-Ramp Flow:**
1. `createCustomer()` → customer ID + KYC URL
2. Complete KYC (iframe)
3. `getQuote(MXN → CETES)` → quote with rate, expiry
4. `createOnRamp(quoteId, destinationAddress)` → SPEI payment instructions
5. User pays via SPEI
6. Poll `getOnRampTransaction()` until status = completed
7. CETES arrives in Stellar wallet

**Off-Ramp Flow:**
1. `getQuote(CETES → MXN)` → quote
2. `createOffRamp()` → transaction created
3. Poll until `signableTransaction` is available
4. Sign & submit burn transaction
5. Poll until MXN settled to bank

---

## Architecture Decision: CETES + Blend

### The Problem
CETES is likely NOT a supported collateral asset in Blend testnet pools. Blend pools typically support: USDC, XLM, EURC, BLND.

### Chosen Approach: Option B - Swap Path

**Flow:**
```
MXN → [Etherfuse] → CETES → [Stellar DEX] → USDC → [Blend] → Borrow XLM → Pay
```

**Why this is honest:**
1. Follows real anchor flow (not just minting tokens)
2. Uses real Stellar DEX for swaps
3. Uses real Blend pools with real positions
4. If CETES/USDC liquidity doesn't exist on testnet DEX, we'll create a test orderbook or use path payments

**Fallback (if no DEX liquidity):**
For the demo, we may need to:
1. Mint test CETES ourselves (simulating a successful on-ramp)
2. Seed a CETES/USDC orderbook on testnet
3. OR skip the swap and go directly: on-ramp mock USDC → Blend

This will be clearly documented in README.

---

## Technical Architecture

```
/ya-otter-pay-me
├── /app                    # Next.js 14 App Router
│   ├── /api
│   │   └── /anchor         # Proxy routes for Etherfuse API
│   ├── page.tsx            # Main app (single-page with sections)
│   ├── layout.tsx
│   └── globals.css
├── /components
│   ├── WalletConnect.tsx
│   ├── OnRamp.tsx
│   ├── BlendSupply.tsx
│   ├── BlendBorrow.tsx
│   ├── Payment.tsx
│   ├── BlendRepay.tsx
│   ├── BlendWithdraw.tsx
│   ├── OffRamp.tsx
│   └── OtterStatus.tsx     # Mascot status messages
├── /lib
│   ├── /stellar
│   │   ├── config.ts       # Network config, RPC client
│   │   ├── transaction.ts  # TX building, simulation, submission
│   │   └── assets.ts       # Asset definitions
│   ├── /anchor
│   │   ├── client.ts       # Etherfuse API client
│   │   ├── types.ts        # Type definitions
│   │   └── mock.ts         # Mock for testnet (if needed)
│   └── /blend
│       ├── client.ts       # Blend SDK wrapper
│       ├── pool.ts         # Pool operations
│       └── positions.ts    # Position calculations
├── /hooks
│   ├── useWallet.ts        # Freighter integration
│   ├── useBlend.ts         # Blend state management
│   └── useAnchor.ts        # Anchor flow state
├── .env.local              # Local config (gitignored)
├── .env.example            # Template
├── README.md
└── PLAN.md
```

---

## Environment Variables

```bash
# Network
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Etherfuse Anchor (server-side only)
ETHERFUSE_API_KEY=
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com

# Assets
NEXT_PUBLIC_USDC_ISSUER=GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
NEXT_PUBLIC_CETES_ISSUER=  # TBD - may need to create test asset

# Blend
NEXT_PUBLIC_BLEND_POOL_ID=  # Discover from testnet.blend.capital
NEXT_PUBLIC_BLEND_BACKSTOP=CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA
```

---

## Implementation Steps

### Phase 1: Foundation
1. Scaffold Next.js project with TypeScript
2. Install dependencies: `@stellar/stellar-sdk`, `@stellar/freighter-api`, `@blend-capital/blend-sdk`
3. Set up Tailwind CSS
4. Create network config and RPC client

### Phase 2: Wallet & Balances
1. Implement Freighter connection
2. Display connected wallet address
3. Fetch and display balances (XLM, USDC, CETES, bTokens, dTokens)

### Phase 3: Anchor Integration
1. Port Etherfuse client from regional-starter-pack
2. Create API routes for proxying (keep API key server-side)
3. Implement on-ramp flow UI
4. Implement off-ramp flow UI
5. Add mock mode for testnet if Etherfuse sandbox unavailable

### Phase 4: Blend Integration
1. Discover testnet pool ID
2. Implement pool data loading
3. Implement supply collateral flow
4. Implement borrow flow
5. Implement repay flow
6. Implement withdraw flow
7. Add health factor display

### Phase 5: Payment
1. Simple send to address form
2. Transaction building and signing
3. Success/failure feedback

### Phase 6: Polish
1. Add otter status messages
2. Error handling throughout
3. Loading states
4. Transaction simulation before send
5. README documentation

---

## Otter Status Messages

| State | Message |
|-------|---------|
| No wallet | "Otter is waiting for a friend..." |
| Connected, no position | "Otter is ready to dive in!" |
| CETES acquired | "Otter found some shells!" |
| Collateral supplied | "Otter is floating (supplied collateral)" |
| Borrowed | "Otter borrowed some shells (debt opened)" |
| Healthy position | "Otter is calm (healthy position)" |
| Low health factor | "Otter is nervous (health factor low!)" |
| Payment sent | "Otter delivered the goods!" |
| Debt repaid | "Otter paid it back (debt cleared)" |
| Withdrawn | "Otter retrieved the shells!" |

---

## Risk Mitigation

1. **Etherfuse sandbox may not work**: Implement mock mode that simulates the flow
2. **CETES not on testnet**: Create our own test asset and document clearly
3. **No DEX liquidity**: Seed orderbook ourselves or skip swap step
4. **Blend pool discovery**: Check testnet.blend.capital UI, extract from network requests

---

## Demo Runbook (Happy Path)

1. Start app: `npm run dev`
2. Open http://localhost:3000
3. Click "Connect Wallet" → Freighter prompt
4. **On-Ramp**: Enter amount MXN → See SPEI instructions → (simulated) receive CETES
5. **Supply**: Click "Supply to Blend" → Sign transaction → See collateral position
6. **Borrow**: Enter amount → Click "Borrow USDC" → Sign → See debt position
7. **Pay**: Enter recipient address + amount → Click "Send" → Sign → Success
8. **Repay**: Click "Repay" → Sign → Debt reduced/cleared
9. **Withdraw**: Click "Withdraw" → Sign → Collateral returned
10. **Off-Ramp** (optional): Initiate off-ramp → Sign burn → (simulated) receive MXN

---

## Next Steps

Proceeding to scaffold the project and implement in small commits.
