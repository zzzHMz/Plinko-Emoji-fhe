"use client"

import { useState, useEffect, useCallback } from "react"
import { Navigation } from "@/components/navigation"
import { ResponsiveCanvas } from "@/components/responsive-canvas"
import { Leaderboard } from "@/components/leaderboard"
import { GameStats } from "@/components/game-stats"
import { SecurityStatus } from "@/components/security-status"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, TrendingUp, Smartphone, Gift, ShoppingCart, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useContract } from "@/hooks/use-contract"

export default function PlinkoGame() {
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [gameResults, setGameResults] = useState<{ multiplier: number; slot: number; timestamp: number }[]>([])
  const [turnsToBy, setTurnsToBuy] = useState(1)
  const [checkInCountdown, setCheckInCountdown] = useState<string>("") 
  const [canCheckIn, setCanCheckIn] = useState(true)
  const [playerStats, setPlayerStats] = useState({
    gamesPlayed: 0,
    totalWinnings: "0.00",
    bestMultiplier: 0,
    winRate: 0,
    averageMultiplier: 0,
  })
  const { toast } = useToast()

  const {
    isInitialized,
    isLoading,
    isAuthenticated,
    leaderboard,
    playerInfo,
    securityManager,
    initializeContract,
    dailyCheckIn,
    buyTurns,
    playGame,
    submitGameResult,
    refreshPlayerInfo,
  } = useContract()

  // Check-in countdown timer
    const calculateCountdown = useCallback(() => {
      if (!playerInfo || playerInfo.lastCheckInTime === 0) {
        setCanCheckIn(true)
        setCheckInCountdown("")
        return
      }
  
      const lastCheckIn = playerInfo.lastCheckInTime * 1000 // Convert to ms
      const nextCheckIn = lastCheckIn + 24 * 60 * 60 * 1000 // 24 hours later
      const now = Date.now()
      const remaining = nextCheckIn - now
  
      if (remaining <= 0) {
        setCanCheckIn(true)
        setCheckInCountdown("")
      } else {
        setCanCheckIn(false)
        const hours = Math.floor(remaining / (1000 * 60 * 60))
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
        setCheckInCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, [playerInfo])
  
    useEffect(() => {
      calculateCountdown()
      const interval = setInterval(calculateCountdown, 1000)
      return () => clearInterval(interval)
    }, [calculateCountdown])
  
    const handleWalletConnected = async (address: string) => {
    setWalletAddress(address)
    setIsConnected(true)

    // Initialize contract when wallet is connected
    try {
      await initializeContract(address)
    } catch (error) {
      console.error("Failed to initialize contract:", error)
    }
  }

  const handleWalletDisconnected = () => {
    setWalletAddress("")
    setIsConnected(false)
  }

  const handleDailyCheckIn = async () => {
    const success = await dailyCheckIn()
    if (success) {
      await refreshPlayerInfo()
    }
  }

  const handleBuyTurns = async () => {
    const success = await buyTurns(turnsToBy)
    if (success) {
      await refreshPlayerInfo()
    }
  }

  const handleTurnUsed = async () => {
    // Refresh player info after a turn is used
    await refreshPlayerInfo()
  }

  const updatePlayerStats = (multiplier: number) => {
    setPlayerStats((prev) => {
      const newGamesPlayed = prev.gamesPlayed + 1
      const newBestMultiplier = Math.max(prev.bestMultiplier, multiplier)
      const wins = multiplier >= 1 ? 1 : 0
      const newWinRate = (prev.winRate * prev.gamesPlayed + wins * 100) / newGamesPlayed
      const newAverageMultiplier = (prev.averageMultiplier * prev.gamesPlayed + multiplier) / newGamesPlayed

      // Calculate winnings (simplified calculation)
      const gameWinning = multiplier >= 1 ? 0.01 * multiplier : 0
      const newTotalWinnings = (Number.parseFloat(prev.totalWinnings) + gameWinning).toFixed(4)

      return {
        gamesPlayed: newGamesPlayed,
        totalWinnings: newTotalWinnings,
        bestMultiplier: newBestMultiplier,
        winRate: Math.round(newWinRate),
        averageMultiplier: newAverageMultiplier,
      }
    })
  }

  const handleGameResult = async (multiplier: number, slot: number) => {
    const result = { multiplier, slot, timestamp: Date.now() }
    setGameResults((prev) => [result, ...prev.slice(0, 9)]) // Keep last 10 results

    // Update player stats
    updatePlayerStats(multiplier)

    if (isInitialized) {
      // Use the actual game ID from the last playGame call, or generate one for fallback
      const gameId = Math.floor(Math.random() * 1000000)
      await submitGameResult(gameId, multiplier, slot)
    }

    toast({
      title: "Game Result",
      description: `Ball landed in slot ${slot + 1} with ${multiplier}x multiplier!`,
    })
  }

  const handlePlayGame = async (): Promise<number | null> => {
    console.log("[v0] Handle play game called")

    if (!isInitialized) {
      toast({
        title: "Please Wait",
        description: "System is still initializing...",
        variant: "destructive",
      })
      return null
    }

    return await playGame()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onWalletConnected={handleWalletConnected} onWalletDisconnected={handleWalletDisconnected} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Mobile-first responsive grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Game Area - Full width on mobile, 3/4 on desktop */}
          <div className="xl:col-span-3 order-1">
            <Card className="bg-card/50 border-border backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-2xl font-bold text-foreground flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">😊</span>
                    Plinko Emoji Game
                  </div>
                  {isConnected && (
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          isInitialized ? "bg-secondary/20 text-secondary" : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-1">
                            <LoadingSpinner size="sm" />
                            Initializing...
                          </div>
                        ) : isInitialized ? (
                          "Contract Ready"
                        ) : (
                          "Initializing..."
                        )}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          isAuthenticated ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {isAuthenticated ? "Authenticated" : "Authenticating..."}
                      </span>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-6">
                <ResponsiveCanvas
                  onGameResult={handleGameResult}
                  isConnected={isConnected && isInitialized}
                  onPlayGame={handlePlayGame}
                  isLoading={isLoading}
                  availableTurns={playerInfo?.availableTurns || 0}
                  onTurnUsed={handleTurnUsed}
                />
              </CardContent>
            </Card>

            {/* Recent Results - Show on mobile after game */}
            {gameResults.length > 0 && (
              <Card className="bg-card/50 border-border backdrop-blur-sm mt-4 sm:mt-6">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-secondary" />
                    Your Recent Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                    {gameResults.map((result, index) => (
                      <div
                        key={result.timestamp}
                        className="text-center p-2 sm:p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-all duration-300 hover:scale-105"
                        style={{
                          animation: `slideInFromRight 0.3s ease-out forwards ${index * 100}ms`,
                        }}
                      >
                        <div className="text-sm sm:text-lg font-bold text-secondary">{result.multiplier}x</div>
                        <div className="text-xs text-muted-foreground">Slot {result.slot + 1}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Stack on mobile, sidebar on desktop */}
          <div className="xl:col-span-1 order-2 xl:order-2 space-y-4 sm:space-y-6">
            {/* Player Controls - Check-in & Buy Turns */}
            {isConnected && isInitialized && (
              <Card className="bg-card/50 border-border backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Player Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Available Turns Display */}
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Available Turns</p>
                      <p className="text-2xl font-bold text-primary">
                        {playerInfo?.availableTurns || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Games Played: {playerInfo?.gamesPlayed || 0}
                      </p>
                    </div>
                  </div>

                  {/* Daily Check-in Button */}
                  <div className="space-y-2">
                    <Button
                      onClick={handleDailyCheckIn}
                      disabled={isLoading || !canCheckIn}
                      className={`w-full ${canCheckIn ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' : 'bg-gray-500 cursor-not-allowed'}`}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      {isLoading ? "Checking in..." : canCheckIn ? "Daily Check-in (+3 turns)" : "Already Checked In"}
                    </Button>
                    
                    {!canCheckIn && checkInCountdown && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Next check-in in: <span className="font-mono text-primary">{checkInCountdown}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Buy Turns Section */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Buy More Turns (0.001 ETH each)</p>
                    <div className="flex gap-2 w-full">
                      <input
                        type="number"
                        min="1"
                        value={turnsToBy}
                        onChange={(e) => setTurnsToBuy(Math.max(1, Number(e.target.value)))}
                        className="w-20 min-w-0 px-3 py-2 text-sm rounded-md border border-border bg-background text-center"
                      />
                      <Button
                        onClick={handleBuyTurns}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        Buy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Total: {(turnsToBy * 0.001).toFixed(3)} ETH
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mobile indicator */}
            <div className="xl:hidden">
              <Card className="bg-card/50 border-border backdrop-blur-sm">
                <CardContent className="p-3">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs">Swipe up for more stats</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <SecurityStatus address={walletAddress} securityManager={securityManager} isConnected={isConnected} />

            {/* Enhanced Leaderboard */}
            <Leaderboard entries={leaderboard} currentPlayer={walletAddress} isLoading={isLoading} />

            {/* Enhanced Game Stats */}
            <GameStats playerStats={isConnected ? playerStats : undefined} isConnected={isConnected} />
          </div>
        </div>
      </main>
    </div>
  )
}
