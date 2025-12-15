"use client"

import { useState, useEffect, useCallback } from "react"
import { ethers } from "ethers"
import { PlinkoContract, PLINKO_CONTRACT_ADDRESS, type LeaderboardEntry, type PlayerInfo } from "@/lib/contract"
import { EIP712Signer } from "@/lib/eip712"
import { RelayerSDK } from "@/lib/relayer-sdk"
import { useToast } from "@/hooks/use-toast"
import { useSecurity } from "@/hooks/use-security"

export function useContract() {
  const [contract, setContract] = useState<PlinkoContract | null>(null)
  const [eip712Signer, setEip712Signer] = useState<EIP712Signer | null>(null)
  const [relayerSDK, setRelayerSDK] = useState<RelayerSDK | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null)
  const [fallbackMode, setFallbackMode] = useState(false)
  const { toast } = useToast()

  const { securityManager, isAuthenticated, authenticateUser, validateGameAttempt, recordGameResult } = useSecurity()

  const initializeContract = useCallback(
    async (walletAddress: string) => {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found")
      }

      try {
        setIsLoading(true)
        console.log("[Plinko] Starting contract initialization for:", walletAddress)

        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()

        let eip712Instance: EIP712Signer | null = null
        try {
          eip712Instance = new EIP712Signer(signer)
          setEip712Signer(eip712Instance)
          console.log("[Plinko] EIP-712 signer initialized")
        } catch (eip712Error) {
          console.warn("[Plinko] EIP-712 initialization failed:", eip712Error)
          setFallbackMode(true)
        }

        try {
          const plinkoContract = new PlinkoContract()
          await plinkoContract.initialize(provider)
          setContract(plinkoContract)
          console.log("[Plinko] Contract initialized at:", PLINKO_CONTRACT_ADDRESS)

          // Fetch initial player info
          const info = await plinkoContract.getPlayerInfo(walletAddress)
          setPlayerInfo(info)
          console.log("[Plinko] Player info:", info)
        } catch (contractError) {
          console.warn("[Plinko] Contract initialization failed, enabling fallback mode:", contractError)
          setFallbackMode(true)
        }

        try {
          const relayer = RelayerSDK.getInstance()
          await relayer.initialize(PLINKO_CONTRACT_ADDRESS)
          setRelayerSDK(relayer)
          console.log("[Plinko] Relayer SDK initialized")
        } catch (relayerError) {
          console.warn("[Plinko] Relayer SDK initialization failed:", relayerError)
          setFallbackMode(true)
        }

        if (eip712Instance) {
          try {
            const authSuccess = await authenticateUser(walletAddress, eip712Instance)
            if (!authSuccess) {
              console.warn("[Plinko] Authentication failed, enabling fallback mode")
              setFallbackMode(true)
            } else {
              console.log("[Plinko] Authentication successful")
            }
          } catch (authError) {
            console.warn("[Plinko] Authentication error, enabling fallback mode:", authError)
            setFallbackMode(true)
          }
        } else {
          console.warn("[Plinko] No EIP-712 signer available, enabling fallback mode")
          setFallbackMode(true)
        }

        setIsInitialized(true)

        if (fallbackMode) {
          toast({
            title: "Basic Mode Enabled",
            description: "Some advanced features unavailable, but you can still play!",
          })
        } else {
          toast({
            title: "Contract Initialized",
            description: "Connected to Plinko Game on Sepolia",
          })
        }
      } catch (error: any) {
        console.error("[Plinko] Critical initialization error:", error)
        setFallbackMode(true)
        setIsInitialized(true)
        toast({
          title: "Fallback Mode",
          description: "Playing in offline mode - limited features available",
        })
      } finally {
        setIsLoading(false)
      }
    },
    [toast, authenticateUser],
  )

  // Daily check-in to get 3 free turns
  const dailyCheckIn = useCallback(async (): Promise<boolean> => {
    if (!contract || !contract.isReady()) {
      toast({
        title: "Not Ready",
        description: "Please wait for contract to initialize",
        variant: "destructive",
      })
      return false
    }

    try {
      setIsLoading(true)
      const address = await contract.getSignerAddress()
      if (!address) throw new Error("No wallet connected")

      // Check if can check in
      const canCheck = await contract.canCheckIn(address)
      if (!canCheck) {
        toast({
          title: "Already Checked In",
          description: "You can check in again tomorrow!",
          variant: "destructive",
        })
        return false
      }

      toast({
        title: "Checking In...",
        description: "Please confirm the transaction in MetaMask",
      })

      const txHash = await contract.dailyCheckIn()

      // Update player info
      const info = await contract.getPlayerInfo(address)
      setPlayerInfo(info)

      toast({
        title: "Check-in Successful!",
        description: `You received 3 free turns! Tx: ${txHash?.slice(0, 10)}...`,
      })

      return true
    } catch (error: any) {
      console.error("[Plinko] Check-in error:", error)
      if (error.code === 4001) {
        toast({
          title: "Transaction Cancelled",
          description: "You cancelled the check-in transaction",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Check-in Failed",
          description: error.message || "Failed to check in",
          variant: "destructive",
        })
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [contract, toast])

  // Buy additional turns
  const buyTurns = useCallback(async (turnCount: number): Promise<boolean> => {
    if (!contract || !contract.isReady()) {
      toast({
        title: "Not Ready",
        description: "Please wait for contract to initialize",
        variant: "destructive",
      })
      return false
    }

    try {
      setIsLoading(true)
      const cost = (turnCount * 0.001).toFixed(3)

      toast({
        title: "Buying Turns...",
        description: `Please confirm ${cost} ETH transaction in MetaMask`,
      })

      const txHash = await contract.buyTurns(turnCount)

      // Update player info
      const address = await contract.getSignerAddress()
      if (address) {
        const info = await contract.getPlayerInfo(address)
        setPlayerInfo(info)
      }

      toast({
        title: "Purchase Successful!",
        description: `You bought ${turnCount} turn(s) for ${cost} ETH. Tx: ${txHash?.slice(0, 10)}...`,
      })

      return true
    } catch (error: any) {
      console.error("[Plinko] Buy turns error:", error)
      if (error.code === 4001) {
        toast({
          title: "Transaction Cancelled",
          description: "You cancelled the purchase",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Purchase Failed",
          description: error.message || "Failed to buy turns",
          variant: "destructive",
        })
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [contract, toast])

  // Refresh player info
  const refreshPlayerInfo = useCallback(async () => {
    if (!contract || !contract.isReady()) return

    try {
      const address = await contract.getSignerAddress()
      if (address) {
        const info = await contract.getPlayerInfo(address)
        setPlayerInfo(info)
      }
    } catch (error) {
      console.error("[Plinko] Error refreshing player info:", error)
    }
  }, [contract])

  const playGame = useCallback(async (): Promise<number | null> => {
    console.log("[Plinko] Play game called")
    console.log(
      "[Plinko] Play game - initialized:",
      isInitialized,
      "authenticated:",
      isAuthenticated,
      "fallback:",
      fallbackMode,
    )

    if (!isInitialized) {
      toast({
        title: "Not Ready",
        description: "Please wait for initialization to complete",
        variant: "destructive",
      })
      return null
    }

    if (!contract || !contract.isReady()) {
      console.log("[Plinko] Contract not ready, using fallback mode")
      const mockGameId = Math.floor(Math.random() * 1000000)
      toast({
        title: "Game Started (Offline)",
        description: "Playing in offline mode - drop the ball!",
      })
      return mockGameId
    }

    const signerAddress = await contract.getSignerAddress()
    if (!signerAddress) {
      console.log("[Plinko] No signer address available, using fallback mode")
      const mockGameId = Math.floor(Math.random() * 1000000)
      toast({
        title: "Game Started (Offline)",
        description: "Playing in offline mode - drop the ball!",
      })
      return mockGameId
    }

    // Check if player has turns
    const info = await contract.getPlayerInfo(signerAddress)
    if (info.availableTurns <= 0) {
      toast({
        title: "No Turns Available",
        description: "Please check-in daily or buy more turns to play!",
        variant: "destructive",
      })
      return null
    }

    const validation = validateGameAttempt(signerAddress)
    if (!validation.allowed) {
      toast({
        title: "Rate Limited",
        description: validation.reason || "Please wait before playing again",
        variant: "destructive",
      })
      return null
    }

    try {
      setIsLoading(true)

      toast({
        title: "Playing Turn...",
        description: "Please confirm the transaction in MetaMask",
      })

      console.log("[Plinko] Calling contract.playTurn()...")
      const txHash = await contract.playTurn()
      const gameId = Math.floor(Math.random() * 1000000)

      // Refresh player info after turn is used
      await refreshPlayerInfo()

      toast({
        title: "Turn Used!",
        description: `Tx: ${txHash?.slice(0, 10)}... Drop the ball!`,
      })

      return gameId
    } catch (error: any) {
      console.error("[Plinko] Error playing turn:", error)

      if (error.code === 4001) {
        toast({
          title: "Transaction Cancelled",
          description: "You cancelled the transaction. Try again to play!",
          variant: "destructive",
        })
      } else if (error.message?.includes("No turns available")) {
        toast({
          title: "No Turns Available",
          description: "Please check-in daily or buy more turns!",
          variant: "destructive",
        })
      } else if (error.code === -32603) {
        toast({
          title: "Network Error",
          description: "Please check your network connection and try again",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Transaction Failed",
          description: error.message || "Failed to send transaction",
          variant: "destructive",
        })
      }

      return null
    } finally {
      setIsLoading(false)
    }
  }, [contract, isInitialized, isAuthenticated, fallbackMode, validateGameAttempt, toast, refreshPlayerInfo])

  const submitGameResult = useCallback(
    async (gameId: number, multiplier: number, slot: number): Promise<void> => {
      const playerAddress = (await contract?.getSignerAddress()) || ""

      const isValidResult = recordGameResult(playerAddress, multiplier, slot)
      if (!isValidResult) {
        return
      }

      const addToLocalLeaderboard = (address: string, score: number) => {
        const newEntry: LeaderboardEntry = {
          player: address,
          gamesPlayed: 1,
          score: score,
        }

        setLeaderboard((prev) => {
          // Check if player already exists
          const existingIndex = prev.findIndex((entry) => entry.player === address)
          if (existingIndex >= 0) {
            // Update existing entry
            const updated = [...prev]
            updated[existingIndex] = {
              ...updated[existingIndex],
              gamesPlayed: updated[existingIndex].gamesPlayed + 1,
              score: updated[existingIndex].score + score,
            }
            return updated.sort((a, b) => b.score - a.score)
          }
          // Add new entry and keep top 50 entries
          return [newEntry, ...prev].slice(0, 50)
        })
      }

      // Always update local leaderboard first
      if (playerAddress) {
        const score = Math.round(multiplier * 100) // Convert multiplier to score
        addToLocalLeaderboard(playerAddress, score)
      }

      // Try to submit to blockchain if available
      if (contract && relayerSDK && isInitialized && isAuthenticated && !fallbackMode) {
        try {
          setIsLoading(true)

          const encryptedResult = await relayerSDK.encryptInput(multiplier * 100 + slot)
          await contract.submitResult(gameId, multiplier, slot)
          await relayerSDK.submitEncryptedResult(gameId, encryptedResult)

          // Refresh player info
          await refreshPlayerInfo()

          toast({
            title: "Result Submitted",
            description: `Game result recorded securely on blockchain`,
          })

          // Fetch updated leaderboard from contract
          await fetchLeaderboard()
        } catch (error: any) {
          console.error("Error submitting result:", error)
          if (error.code === 4001) {
            toast({
              title: "Signature Cancelled",
              description: "Result saved locally but not submitted to blockchain",
            })
          } else {
            toast({
              title: "Blockchain Submission Failed",
              description: "Result saved locally - blockchain sync will retry later",
              variant: "destructive",
            })
          }
        } finally {
          setIsLoading(false)
        }
      } else {
        // Fallback mode - just show local update
        toast({
          title: "Result Recorded",
          description: `Score: ${Math.round(multiplier * 100)} points (offline mode)`,
        })
      }
    },
    [contract, relayerSDK, isInitialized, isAuthenticated, fallbackMode, recordGameResult, toast, refreshPlayerInfo],
  )

  const fetchLeaderboard = useCallback(async () => {
    if (!contract) return

    try {
      const entries = await contract.getLeaderboard()
      setLeaderboard(entries)
    } catch (error) {
      console.error("Error fetching leaderboard:", error)
    }
  }, [contract])

  useEffect(() => {
    if (isInitialized && contract) {
      fetchLeaderboard()
    }
  }, [isInitialized, contract]) // Removed fetchLeaderboard from dependencies

  return {
    contract,
    eip712Signer,
    relayerSDK,
    securityManager,
    isInitialized,
    isLoading,
    isAuthenticated: isAuthenticated || fallbackMode,
    leaderboard,
    playerInfo,
    initializeContract,
    dailyCheckIn,
    buyTurns,
    playGame,
    submitGameResult,
    fetchLeaderboard,
    refreshPlayerInfo,
  }
}
