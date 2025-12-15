import { ethers } from "ethers"

// Plinko Game Contract ABI - Deployed on Sepolia
export const PLINKO_CONTRACT_ABI = [
  // View functions
  {
    inputs: [],
    name: "DAILY_FREE_TURNS",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "TURN_PRICE",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "playerAddress", type: "address" }],
    name: "canCheckIn",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "playerAddress", type: "address" }],
    name: "getPlayerInfo",
    outputs: [
      { internalType: "uint256", name: "lastCheckInTime", type: "uint256" },
      { internalType: "uint256", name: "availableTurns", type: "uint256" },
      { internalType: "uint256", name: "gamesPlayed", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "playerAddress", type: "address" }],
    name: "getPlayerScore",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      {
        components: [
          { internalType: "address", name: "playerAddress", type: "address" },
          { internalType: "uint256", name: "gamesPlayed", type: "uint256" },
        ],
        internalType: "struct PlinkoGame.LeaderboardEntry[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalPlayers",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // State-changing functions
  {
    inputs: [],
    name: "dailyCheckIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "turnCount", type: "uint256" }],
    name: "buyTurns",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "encryptedScore", type: "bytes32" },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "dropBall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "turnsGranted", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "CheckedIn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "turnsBought", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "amountPaid", type: "uint256" },
    ],
    name: "TurnsPurchased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "turnsRemaining", type: "uint256" },
    ],
    name: "GamePlayed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "gamesPlayed", type: "uint256" },
    ],
    name: "ScoreUpdated",
    type: "event",
  },
  // playTurn function
  {
    inputs: [],
    name: "playTurn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const

// Contract address on Sepolia testnet - DEPLOYED
export const PLINKO_CONTRACT_ADDRESS = "0x5c8f1Bb82aDB0Aa5619Fb0D04ceC917827bC4E0f"

// FHEVM Configuration for Sepolia
export const FHEVM_CONFIG = {
  relayerUrl: "https://relayer.testnet.zama.org",
  aclAddress: "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D",
  coprocessorAddress: "0x92C920834Ec8941d2C77D188936E1f7A6f49c127",
  kmsVerifierAddress: "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A",
  chainId: 11155111, // Sepolia
}

// Game constants
export const TURN_PRICE = "0.001" // 0.001 ETH per turn
export const DAILY_FREE_TURNS = 3

export interface LeaderboardEntry {
  player: string
  gamesPlayed: number
  score: number
}

export interface PlayerInfo {
  lastCheckInTime: number
  availableTurns: number
  gamesPlayed: number
}

export interface GameResult {
  multiplier: number
  slot: number
  score: number
}

export class PlinkoContract {
  private contract: ethers.Contract | null = null
  private signer: ethers.Signer | null = null
  private provider: ethers.BrowserProvider | null = null

  async initialize(provider: ethers.BrowserProvider) {
    this.provider = provider
    this.signer = await provider.getSigner()
    this.contract = new ethers.Contract(PLINKO_CONTRACT_ADDRESS, PLINKO_CONTRACT_ABI, this.signer)
  }

  async getSignerAddress(): Promise<string | null> {
    if (!this.signer) return null
    try {
      return await this.signer.getAddress()
    } catch (error) {
      console.error("[Plinko] Error getting signer address:", error)
      return null
    }
  }

  isReady(): boolean {
    return !!(this.contract && this.signer)
  }

  // Check if player can check in today
  async canCheckIn(address: string): Promise<boolean> {
    if (!this.contract) throw new Error("Contract not initialized")
    try {
      return await this.contract.canCheckIn(address)
    } catch (error) {
      console.error("[Plinko] Error checking check-in status:", error)
      return true // Default to allowing check-in if error
    }
  }

  // Perform daily check-in to get 3 free turns
  async dailyCheckIn(): Promise<string> {
    if (!this.contract) throw new Error("Contract not initialized")
    console.log("[Plinko] Performing daily check-in...")
    const tx = await this.contract.dailyCheckIn()
    console.log("[Plinko] Check-in transaction sent:", tx.hash)
    await tx.wait()
    console.log("[Plinko] Check-in confirmed!")
    return tx.hash
  }

  // Buy additional turns with ETH
  async buyTurns(turnCount: number): Promise<string> {
    if (!this.contract) throw new Error("Contract not initialized")
    const value = ethers.parseEther((turnCount * 0.001).toString())
    console.log(`[Plinko] Buying ${turnCount} turns for ${ethers.formatEther(value)} ETH...`)
    const tx = await this.contract.buyTurns(turnCount, { value })
    console.log("[Plinko] Buy turns transaction sent:", tx.hash)
    await tx.wait()
    console.log("[Plinko] Turns purchased successfully!")
    return tx.hash
  }

  // Drop ball with encrypted score
  async dropBall(encryptedScore: string, inputProof: string): Promise<void> {
    if (!this.contract) throw new Error("Contract not initialized")
    console.log("[Plinko] Dropping ball with encrypted score...")
    const tx = await this.contract.dropBall(encryptedScore, inputProof)
    console.log("[Plinko] Drop ball transaction sent:", tx.hash)
    await tx.wait()
    console.log("[Plinko] Ball dropped successfully!")
  }

  // Get player info
  async getPlayerInfo(address: string): Promise<PlayerInfo> {
    if (!this.contract) throw new Error("Contract not initialized")
    try {
      const [lastCheckInTime, availableTurns, gamesPlayed] = await this.contract.getPlayerInfo(address)
      return {
        lastCheckInTime: Number(lastCheckInTime),
        availableTurns: Number(availableTurns),
        gamesPlayed: Number(gamesPlayed),
      }
    } catch (error) {
      console.error("[Plinko] Error getting player info:", error)
      return { lastCheckInTime: 0, availableTurns: 0, gamesPlayed: 0 }
    }
  }

  // Get encrypted player score
  async getPlayerScore(address: string): Promise<string> {
    if (!this.contract) throw new Error("Contract not initialized")
    try {
      return await this.contract.getPlayerScore(address)
    } catch (error) {
      console.error("[Plinko] Error getting player score:", error)
      return "0x0"
    }
  }

  // Get leaderboard
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!this.contract) throw new Error("Contract not initialized")

    try {
      const entries = await this.contract.getLeaderboard()
      return entries.map((entry: any) => ({
        player: entry.playerAddress,
        gamesPlayed: Number(entry.gamesPlayed),
        score: Number(entry.gamesPlayed) * 100, // Score based on games played
      }))
    } catch (error) {
      console.error("[Plinko] Error fetching leaderboard:", error)
      // Return empty array if contract call fails
      return []
    }
  }

  // Get total players
  async getTotalPlayers(): Promise<number> {
    if (!this.contract) throw new Error("Contract not initialized")
    try {
      return Number(await this.contract.getTotalPlayers())
    } catch (error) {
      console.error("[Plinko] Error getting total players:", error)
      return 0
    }
  }

  // Legacy playGame method for compatibility - now uses dailyCheckIn or buyTurns
  async playGame(): Promise<number> {
    if (!this.contract) throw new Error("Contract not initialized")
    // This is now a mock - actual game logic uses playTurn
    return Math.floor(Math.random() * 1000000)
  }

  // Play a turn - deducts 1 turn and increments games played
  async playTurn(): Promise<string> {
    if (!this.contract) throw new Error("Contract not initialized")
    console.log("[Plinko] Playing turn...")
    const tx = await this.contract.playTurn()
    console.log("[Plinko] Play turn transaction sent:", tx.hash)
    await tx.wait()
    console.log("[Plinko] Turn played successfully!")
    return tx.hash
  }

  // Legacy submitResult for compatibility
  async submitResult(gameId: number, multiplier: number, slot: number): Promise<void> {
    // Results are now submitted via dropBall with encrypted scores
    console.log("[Plinko] Result recorded locally:", { gameId, multiplier, slot })
  }
}
