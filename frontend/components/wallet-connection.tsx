"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Wallet, LogOut, RefreshCw, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WalletConnectionProps {
  onWalletConnected?: (address: string) => void
  onWalletDisconnected?: () => void
}

const SEPOLIA_CHAIN_ID = "0xaa36a7" // 11155111 in hex
const DISCONNECT_KEY = "plinko-wallet-disconnected"

export function WalletConnection({ onWalletConnected, onWalletDisconnected }: WalletConnectionProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)
  const [isCorrectChain, setIsCorrectChain] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()

  // For portal rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if wallet is already connected on component mount
  useEffect(() => {
    checkWalletConnection()
    checkChain()
    
    // Listen for chain changes
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("chainChanged", (chainId: string) => {
        setIsCorrectChain(chainId === SEPOLIA_CHAIN_ID)
      })
    }
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      // Check if user manually disconnected
      const wasDisconnected = localStorage.getItem(DISCONNECT_KEY) === "true"
      if (wasDisconnected) {
        return // Don't auto-connect if user manually disconnected
      }
      
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setWalletAddress(accounts[0])
          setIsConnected(true)
          onWalletConnected?.(accounts[0])
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
      }
    }
  }

  const checkChain = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" })
        setIsCorrectChain(chainId === SEPOLIA_CHAIN_ID)
      } catch (error) {
        console.error("Error checking chain:", error)
      }
    }
  }

  const switchToSepolia = async () => {
    if (typeof window === "undefined" || !window.ethereum) return

    setIsSwitchingChain(true)
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      })
      setIsCorrectChain(true)
      toast({
        title: "Switched to Sepolia",
        description: "You are now connected to Sepolia Testnet",
      })
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: ["https://sepolia.infura.io/v3/"],
                blockExplorerUrls: ["https://sepolia.etherscan.io/"],
              },
            ],
          })
          setIsCorrectChain(true)
        } catch (addError) {
          console.error("Error adding Sepolia:", addError)
          toast({
            title: "Failed to Add Network",
            description: "Could not add Sepolia network",
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Failed to Switch",
          description: switchError.message || "Could not switch to Sepolia",
          variant: "destructive",
        })
      }
    } finally {
      setIsSwitchingChain(false)
    }
  }

  const connectWallet = async () => {
    setShowWalletModal(true)
  }

  const connectMetaMask = async () => {
    setShowWalletModal(false)
    
    if (typeof window === "undefined" || !window.ethereum) {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to connect your wallet.",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)
    
    // Clear disconnect flag
    localStorage.removeItem(DISCONNECT_KEY)

    try {
      // Force wallet selection popup by requesting permissions
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      })
      
      // Then get accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      })

      if (accounts.length > 0) {
        // Switch to Sepolia testnet
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }], // Sepolia testnet chain ID
          })
        } catch (switchError: any) {
          // If the chain hasn't been added to MetaMask, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Test Network",
                  nativeCurrency: {
                    name: "ETH",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://sepolia.infura.io/v3/"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io/"],
                },
              ],
            })
          }
        }

        setWalletAddress(accounts[0])
        setIsConnected(true)
        onWalletConnected?.(accounts[0])

        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        })
      }
    } catch (error: any) {
      console.error("Error connecting wallet:", error)
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    // Set disconnect flag in localStorage
    localStorage.setItem(DISCONNECT_KEY, "true")
    
    setIsConnected(false)
    setWalletAddress("")
    onWalletDisconnected?.()

    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    })
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (isConnected) {
    return (
      <Card className="bg-card/50 border-border backdrop-blur-sm">
        <div className="flex items-center gap-2 p-3">
          <div className={`w-2 h-2 rounded-full ${isCorrectChain ? 'bg-secondary glow-teal' : 'bg-yellow-500'}`}></div>
          <span className="text-sm font-mono text-foreground">{formatAddress(walletAddress)}</span>
          
          {!isCorrectChain && (
            <Button
              variant="ghost"
              size="sm"
              onClick={switchToSepolia}
              disabled={isSwitchingChain}
              className="text-yellow-500 hover:text-yellow-400"
              title="Switch to Sepolia"
            >
              <RefreshCw className={`w-4 h-4 ${isSwitchingChain ? 'animate-spin' : ''}`} />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={disconnectWallet}
            className="text-muted-foreground hover:text-destructive"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
        
        {!isCorrectChain && (
          <div className="px-3 pb-2">
            <p className="text-xs text-yellow-500">Wrong network! Click ⟳ to switch to Sepolia</p>
          </div>
        )}
      </Card>
    )
  }

  // Wallet Modal Component
  const WalletModal = () => (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={() => setShowWalletModal(false)}
    >
      <div 
        className="bg-card border border-border rounded-xl p-6 w-[320px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-foreground">Connect Wallet</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowWalletModal(false)}
            className="text-muted-foreground hover:text-foreground -mr-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          {/* MetaMask */}
          <button
            onClick={connectMetaMask}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/50 transition-all"
          >
            <div className="w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-8 h-8">
                <path fill="#E17726" d="M37.5 20c0 9.665-7.835 17.5-17.5 17.5S2.5 29.665 2.5 20 10.335 2.5 20 2.5 37.5 10.335 37.5 20z"/>
                <path fill="#E27625" d="M32.5 14.5l-12 4.5 1-7z"/>
                <path fill="#E27625" d="M7.5 14.5l12 4.5-1-7z"/>
                <path fill="#D5BFB2" d="M20 25l-5 7h10z"/>
                <path fill="#233447" d="M20 20l-7 2 2 5 5-2 5 2 2-5z"/>
                <path fill="#CD6116" d="M13 27l7-2-5-3z"/>
                <path fill="#CD6116" d="M27 27l-7-2 5-3z"/>
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">MetaMask</p>
              <p className="text-xs text-muted-foreground">Popular browser wallet</p>
            </div>
          </button>
          
          {/* OKX Wallet */}
          <button
            onClick={connectMetaMask}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/50 transition-all"
          >
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">OKX</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">OKX Wallet</p>
              <p className="text-xs text-muted-foreground">OKX Web3 wallet</p>
            </div>
          </button>
          
          {/* Rabby */}
          <button
            onClick={connectMetaMask}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 hover:border-primary/50 transition-all"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">🐰</span>
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">Rabby</p>
              <p className="text-xs text-muted-foreground">Multi-chain wallet</p>
            </div>
          </button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center mt-4">
          By connecting, you agree to the Terms of Service
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Render modal using Portal to body */}
      {showWalletModal && mounted && createPortal(
        <WalletModal />,
        document.body
      )}

      <Button
        onClick={connectWallet}
        disabled={isConnecting}
        className="bg-primary hover:bg-primary/90 text-primary-foreground glow-purple"
      >
        <Wallet className="w-4 h-4 mr-2" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    </>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}
