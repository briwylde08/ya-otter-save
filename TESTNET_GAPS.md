# Stellar Testnet Integration Gaps

## Issue: Asset Fragmentation Across Protocols

### Problem Summary

When building applications that integrate multiple Stellar protocols (e.g., Etherfuse on-ramp + Stellar DEX + Blend lending), developers encounter a significant barrier: **each protocol uses different test tokens on testnet**, making end-to-end integration testing impossible.

### Specific Example: Ya Otter Save

Our application flow:
1. **On-ramp**: MXN → CETES (via Etherfuse)
2. **Swap**: CETES → USDC (via Stellar DEX)
3. **Deposit**: USDC → Blend Pool (earn yield)

**The problem**: Step 3 fails because Blend's testnet pool uses a *different* USDC than what we receive from the DEX swap.

### The USDC Fragmentation

| Source | USDC Address | Type |
|--------|--------------|------|
| Circle "official" testnet | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | Classic asset |
| Blend testnet pools | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` | Soroban contract |
| Other testnet USDC | `GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56` | Classic asset |

These are **three different tokens** that cannot be swapped 1:1. An application cannot:
- On-ramp to one USDC
- Swap via DEX to another USDC
- Deposit to a pool expecting a third USDC

### Why This Happens

Each protocol creates isolated test environments:
- **Blend**: Creates own test tokens (USDC, wETH, wBTC, XLM SAC) for deterministic protocol testing
- **Etherfuse**: Uses whichever USDC their anchor is configured for
- **DEX Liquidity**: Depends on which tokens market makers provide liquidity for

This makes sense for isolated protocol testing, but breaks cross-protocol integration.

### Why Mainnet Doesn't Have This Problem

On mainnet, there's only ONE real USDC (Circle's):
- Issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

All protocols must use the same token, so flows connect naturally.

### Proposed Solutions

#### 1. Canonical Testnet Assets (Ecosystem-level)
SDF or a working group could establish "canonical" testnet tokens that all protocols agree to support:
- One testnet USDC (with faucet)
- One testnet EURC
- Etc.

#### 2. Integration Test Pools (Protocol-level)
Protocols like Blend could deploy additional testnet pools that accept "standard" testnet assets, specifically for integration testing.

#### 3. Testnet Asset Bridge
A service that wraps/unwraps between different testnet token versions (e.g., swap Classic USDC for Soroban USDC SAC).

#### 4. Better Documentation
At minimum, document which testnet tokens each protocol uses, so developers know upfront about compatibility.

### Current Workaround

For hackathon/demo purposes, we use **mock mode** for the Blend deposit step:
- On-ramp: Real Etherfuse testnet transaction
- Swap: Real Stellar DEX path payment
- Blend Deposit: Simulated (mock) - would work on mainnet with real USDC

### Impact

This gap affects any developer trying to build:
- DeFi aggregators
- Yield optimization apps
- On/off-ramp + DeFi combinations
- Any multi-protocol Stellar application

### Feedback

This document was created during the development of "Ya Otter Save" for a Stellar hackathon. We encountered this issue after successfully implementing real on-ramp (Etherfuse) and real DEX swaps, only to find the Blend deposit step couldn't work due to asset mismatch.

**Recommendation**: The Stellar ecosystem would benefit from a coordinated testnet token standard for integration testing.

---

*Created: February 2025*
*Project: Ya Otter Save - MXN → CETES → USDC → Blend yield flow*
