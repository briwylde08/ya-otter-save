# 🦦 Ya Otter Save

> **WARNING: TESTNET ONLY**
> This application runs on Stellar Testnet and is for demonstration purposes only. Do not use real funds or rely on this for production use. Testnet tokens have no real value.

**Live Demo**: https://ya-otter-save.vercel.app

A Stellar testnet demo app demonstrating a complete savings flow:
- **Etherfuse** for MXN ↔ CETES on/off-ramp
- **Stellar DEX** for CETES ↔ USDC swaps
- **Blend Protocol** for earning yield on USDC deposits

## The Flow

```
MXN (bank)
    │
    ▼ Etherfuse on-ramp
CETES (Mexican T-Bills token)
    │
    ▼ Stellar DEX swap
USDC
    │
    ▼ Blend deposit
USDC earning yield 📈
    │
    ▼ Blend withdraw
USDC + yield
    │
    ▼ Stellar DEX swap
CETES
    │
    ▼ Etherfuse off-ramp
MXN (bank) 💰
```

## Quick Start

```bash
# Clone the repo
git clone https://github.com/briwylde08/ya-otter-save.git
cd ya-otter-save

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with Freighter wallet connected to testnet.

## Environment Variables

```bash
# Network Configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Etherfuse Anchor (server-side only)
ETHERFUSE_API_KEY=your_api_key_here
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com

# Assets (Testnet)
NEXT_PUBLIC_USDC_ISSUER=GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56
NEXT_PUBLIC_CETES_ISSUER=GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4
NEXT_PUBLIC_CETES_CONTRACT_ID=CC72F57YTPX76HAA64JQOEGHQAPSADQWSY5DWVBR66JINPFDLNCQYHIC

# Blend Protocol (Testnet)
NEXT_PUBLIC_BLEND_POOL_ID=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
NEXT_PUBLIC_BLEND_BACKSTOP=CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA
```

## Architecture

```
/ya-otter-save
├── /src
│   ├── /app                 # Next.js App Router
│   │   ├── /api/anchor      # API routes for Etherfuse
│   │   └── page.tsx         # Main application page
│   ├── /components          # React components
│   │   ├── WalletConnect    # Freighter wallet integration
│   │   ├── OnRamp           # MXN → CETES flow
│   │   ├── Swap             # DEX swap (CETES ↔ USDC)
│   │   ├── BlendDeposit     # Supply USDC to Blend
│   │   ├── BlendWithdrawYield # Withdraw with yield
│   │   ├── OffRamp          # CETES → MXN flow
│   │   ├── OtterStatus      # Mascot status messages
│   │   └── SwimmingOtter    # Animated otter 🦦
│   ├── /hooks
│   │   └── useWallet        # Freighter connection hook
│   └── /lib
│       ├── /stellar         # Network config, TX helpers, DEX swap
│       ├── /anchor          # Etherfuse client
│       └── /blend           # Blend SDK wrapper
```

## Integrations

### Etherfuse (On/Off-Ramp)

Etherfuse provides fiat on/off-ramps for Mexican Pesos (MXN) to CETES tokens.

**Key endpoints:**
- `POST /ramp/quote` - Get conversion rates
- `POST /ramp/order` - Create on-ramp/off-ramp order
- `POST /ramp/order/fiat_received` - Simulate payment (testnet)

**Important notes from integration:**
- Auth header: `Authorization: <api_key>` (no Bearer prefix)
- Quote format: `{"type": "onramp", "sourceAsset": "MXN", "targetAsset": "CETES:<issuer>"}`
- Testnet API: `api.sand.etherfuse.com`

### Stellar DEX (Swap)

Uses Horizon's path finding for optimal swap routes:

```typescript
// Find swap paths
const paths = await findStrictSendPaths(CETES, amount, USDC);

// Build path payment
Operation.pathPaymentStrictSend({
  sendAsset: CETES,
  sendAmount: amount,
  destAsset: USDC,
  destMin: minOutput,
  path: paths[0].path,
});
```

**Note:** Testnet may have limited liquidity. The app handles missing paths gracefully.

### Blend Protocol (Yield)

Supply USDC to earn yield from borrowers:

```typescript
// Supply USDC
const op = contract.submit({
  from: userAddress,
  spender: userAddress,
  to: userAddress,
  requests: [{
    request_type: RequestType.Supply,
    address: USDC_CONTRACT,
    amount: amountStroops,
  }],
});
```

**Testnet Pool:** `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`
**Supported assets:** USDC, XLM, wETH, wBTC, BLND

## Demo Happy Path

1. **Connect Wallet** - Connect Freighter on testnet
2. **On-Ramp** - Enter 1000 MXN → Receive ~57 CETES
3. **Swap** - Exchange CETES → USDC via Stellar DEX
4. **Deposit** - Supply USDC to Blend pool
5. **Earn** - Watch yield accrue in real-time
6. **Withdraw** - Retrieve USDC + earned yield
7. **Swap** - Exchange USDC → CETES
8. **Off-Ramp** - Convert CETES → MXN
9. **Celebrate** - Otter is happy! 🦦💰

## What Would Change for Mainnet

1. **Network Config** - Switch to `public` network
2. **Asset Issuers** - Use mainnet CETES issuer: `GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC`
3. **Blend Pool** - Use mainnet pool ID
4. **Etherfuse** - Use production API: `api.etherfuse.com`
5. **DEX Liquidity** - Verify CETES ↔ USDC liquidity exists
6. **KYC** - Implement full KYC flow with Etherfuse

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Stellar SDK**: `@stellar/stellar-sdk` v14
- **Wallet**: `@stellar/freighter-api` v6
- **Lending**: `@blend-capital/blend-sdk` v3

## References

- [Blend Integration Docs](https://docs.blend.capital/tech-docs/integrations/integrate-pool)
- [Blend SDK](https://github.com/blend-capital/blend-sdk-js)
- [Etherfuse](https://www.etherfuse.com/)
- [Stellar DEX Path Payments](https://developers.stellar.org/docs/encyclopedia/path-payments)
- [Freighter Wallet](https://freighter.app/)
- [Arroz Wallet Integration Guide](https://gist.github.com/rice2000/f5cba666112b4fa69afbc70891c47782) - Helpful gotchas

## License

MIT
