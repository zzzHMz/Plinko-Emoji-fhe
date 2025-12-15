# 🎮 Plinko Emoji

A fully on-chain Plinko game using FHE (Fully Homomorphic Encryption) on Sepolia testnet with random emoji balls.

![Plinko Emoji](https://img.shields.io/badge/Network-Sepolia-blue) ![FHE](https://img.shields.io/badge/Encryption-FHE-green) ![Status](https://img.shields.io/badge/Status-Live-success)

## 📁 Project Structure

```
Plinko-Emoji-fhe/
├── backend/          # Smart contracts & Hardhat
│   ├── contracts/
│   │   └── PlinkoGame.sol
│   ├── test/
│   └── deploy/
└── frontend/         # Next.js React frontend
    ├── app/
    ├── components/
    ├── lib/
    └── hooks/
```

## 🚀 Quick Start

### Backend (Smart Contract)

```bash
cd backend
npm install

# Set environment variables
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY

# Compile
npm run compile

# Test locally
npm test

# Deploy to Sepolia
npx hardhat deploy --network sepolia --tags PlinkoGame
```

### Frontend (Next.js)

```bash
cd frontend
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 📝 Deployed Contract

- **Network**: Sepolia Testnet
- **Contract Address**: `0x5c8f1Bb82aDB0Aa5619Fb0D04ceC917827bC4E0f`
- **Explorer**: [View on Etherscan](https://sepolia.etherscan.io/address/0x5c8f1Bb82aDB0Aa5619Fb0D04ceC917827bC4E0f)

## ✨ Features

### Smart Contract (PlinkoGame.sol)

| Feature | Description |
|---------|-------------|
| **Daily Check-in** | Get 3 free turns every 24 hours |
| **Buy Turns** | Purchase additional turns at 0.001 ETH each |
| **Play Turn** | Deducts 1 turn and records game play |
| **FHE Scoring** | Scores encrypted using euint32 (optional) |
| **Leaderboard** | Public ranking by games played |

### Frontend

| Feature | Description |
|---------|-------------|
| **Wallet Connection** | MetaMask, OKX, Rabby support |
| **Network Switching** | Auto-switch to Sepolia |
| **Emoji Balls** | Random emoji selection (😊 😄 😁 🤣 😍 🥳 😎 🤩 😜 🙃) |
| **Plinko Physics** | Real-time ball physics simulation |
| **Check-in Timer** | Countdown to next daily check-in |
| **Transaction Tracking** | Real-time tx hash display |

## 🔐 FHE Integration

Built using Zama's FHEVM:

| Component | Value |
|-----------|-------|
| **Library** | `@fhevm/solidity` |
| **Encrypted Type** | `euint32` for scores |
| **Config** | `ZamaEthereumConfig` |
| **Relayer** | `relayer.testnet.zama.org` |
| **ACL Address** | `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` |
| **Coprocessor** | `0x92C920834Ec8941d2C77D188936E1f7A6f49c127` |
| **KMS Verifier** | `0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A` |

## 🛠️ Tech Stack

### Backend
- Solidity ^0.8.24
- Hardhat
- FHEVM (@fhevm/solidity)
- TypeScript
- Chai/Mocha

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- ethers.js v6
- shadcn/ui

## 📊 Game Constants

| Constant | Value |
|----------|-------|
| Turn Price | 0.001 ETH |
| Daily Free Turns | 3 |
| Check-in Cooldown | 24 hours |
| Slot Multipliers | 1x - 100x |

## 🎯 Zama Developer Program Criteria

### Baseline Requirements (50%)
- ✅ Original tech architecture with Solidity contracts (35%)
- ✅ Working demo deployment on Sepolia (15%)

### Quality & Completeness (30%)
- ✅ Testing - Unit/integration tests (10%)
- ✅ UI/UX design - Intuitive interface (10%)
- ⏳ Presentation video (10%)

### Differentiators (20%)
- ✅ Development effort - Complete solution (10%)
- ✅ Business potential - User-friendly dApp (10%)

## 🔗 Links

- [Contract on Sepolia](https://sepolia.etherscan.io/address/0x5c8f1Bb82aDB0Aa5619Fb0D04ceC917827bC4E0f)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Zama FHEVM Docs](https://docs.zama.ai/protocol)
- [Zama Developer Program](https://docs.zama.org/programs/developer-program)

## ⚠️ Important Notes

1. **Network**: Only works on Sepolia testnet
2. **Wallet**: Requires MetaMask/OKX/Rabby with Sepolia ETH
3. **Relayer**: Must use `relayer.testnet.zama.org`
4. **Transactions**: May take a few seconds to confirm
5. **Security**: Never commit private keys/mnemonics

## 📄 License

BSD-3-Clause-Clear

## 🙏 Credits

Built with:
- [Zama FHEVM](https://www.zama.ai/)
- [Hardhat](https://hardhat.org/)
- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)

---

**Status**: Backend ✅ Complete | Frontend ✅ Complete

