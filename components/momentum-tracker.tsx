"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCoinbase } from "@/hooks/use-coinbase"
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  X,
  RotateCcw,
  Flag,
  Pause,
  Activity,
  Clock,
  Trophy,
  Zap,
  LineChart,
  LayoutList,
  ChevronDown,
  Flame,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  calculateMomentum,
  getTimeframeMs,
  getOptimalBufferSize,
  hasSufficientData,
  type MomentumTimeframe,
  type PricePoint,
} from "@/lib/momentum-calculator"

// Types
interface CoinData {
  id: string
  symbol: string
  name: string
  coinbaseId: string
  currentPrice: number
  sessionStartPrice: number // Price when coin was added or race started
  sessionStartTime: number // Timestamp when tracking started for this coin
  sessionROC: number // % change since session start
  momentum: number // Current velocity (% per selected timeframe)
  lastUpdated: number
  priceHistory: PricePoint[]
}

interface WatchlistData {
  sessionStartTime: number | null
  coins: CoinData[]
}

type SortField = "sessionROC" | "momentum" | "currentPrice"

// LEVERAGE PAIRS - COINBASE ADVANCED TRADE
// These are the ONLY coins available for tracking in this app
// Filtering logic: Only pairs with confirmed leverage trading on Coinbase Advanced Trade
//
// To verify a pair has leverage:
// 1. Check Coinbase Advanced Trade leverage products
// 2. Pair must have perpetual futures or margin trading
// 3. Format: "{ASSET}-USD" (e.g., "BTC-USD")
//
// Current leverage pairs (as of 2024):
// - BTC, ETH, SOL: High liquidity, 3-10x leverage available
// - AVAX, LINK, DOGE, ADA, UNI: Mid-cap with 2-5x leverage
//
// This list is intentionally limited to ensure:
// - Real-time WebSocket data availability
// - Sufficient liquidity for momentum tracking
// - Active leverage trading markets
const LEVERAGE_PAIRS = [
  { symbol: "BTC-USD", name: "Bitcoin", coinbaseId: "BTC-USD" },
  { symbol: "ETH-USD", name: "Ethereum", coinbaseId: "ETH-USD" },
  { symbol: "SOL-USD", name: "Solana", coinbaseId: "SOL-USD" },
  { symbol: "AVAX-USD", name: "Avalanche", coinbaseId: "AVAX-USD" },
  { symbol: "LINK-USD", name: "Chainlink", coinbaseId: "LINK-USD" },
  { symbol: "DOGE-USD", name: "Dogecoin", coinbaseId: "DOGE-USD" },
  { symbol: "ADA-USD", name: "Cardano", coinbaseId: "ADA-USD" },
  { symbol: "UNI-USD", name: "Uniswap", coinbaseId: "UNI-USD" },
]

const COIN_COLORS = ["#A8C7FA", "#00E5FF", "#9C6BFF", "#FF4D6D", "#FFAE2B", "#f97316", "#ec4899", "#06b6d4"]

const OPTIMAL_BUFFER_SIZE = getOptimalBufferSize()

// Brand logo
function Brand() {
  return (
    <div className="flex items-center gap-2 md:gap-3">
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-[#A8C7FA] to-[#00E5FF] flex items-center justify-center text-[#121212] font-bold text-sm md:text-base">
        PD
      </div>
      <div className="leading-tight">
        <div className="text-sm md:text-lg font-bold text-[#E3E3E3]">PurpDex</div>
        <div className="hidden md:block text-[10px] md:text-xs text-[#9AA0A6]">Live Leverage Tracker</div>
      </div>
    </div>
  )
}

// Utilities
const generateCoinId = (symbol: string) => `${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const calculateSessionROC = (currentPrice: number, sessionStartPrice: number): number => {
  if (!sessionStartPrice) return 0
  return ((currentPrice - sessionStartPrice) / sessionStartPrice) * 100
}

const formatPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`

const formatElapsedTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// Momentum Timeframe Selector
function MomentumTimeframeSelector({
  timeframe,
  onTimeframeChange,
}: {
  timeframe: MomentumTimeframe
  onTimeframeChange: (tf: MomentumTimeframe) => void
}) {
  const timeframes: MomentumTimeframe[] = ["30s", "1m", "2m", "5m"]

  return (
    <div className="flex items-center gap-1 bg-[#1E1E1E] rounded-lg p-1 border border-[#3C4043]">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs transition-all font-medium ${
            timeframe === tf
              ? "bg-[#A8C7FA] text-[#121212] shadow-lg"
              : "text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-[#292A2D]"
          }`}
          aria-label={`Set momentum timeframe to ${tf}`}
          aria-pressed={timeframe === tf}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

// Add Coin Typeahead
function AddCoinTypeahead({
  value,
  onValueChange,
  existingSymbols,
  onSelectCoin,
  onAddFirstMatch,
}: {
  value: string
  onValueChange: (v: string) => void
  existingSymbols: string[]
  onSelectCoin: (coin: (typeof LEVERAGE_PAIRS)[number]) => void
  onAddFirstMatch: () => void
}) {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return LEVERAGE_PAIRS.filter(
      (c) =>
        !existingSymbols.includes(c.symbol) && (c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    ).slice(0, 8)
  }, [value, existingSymbols])

  useEffect(() => {
    setOpen(Boolean(value) && filtered.length > 0)
  }, [value, filtered.length])

  const handleSelectCoin = useCallback(
    (coin: (typeof LEVERAGE_PAIRS)[number]) => {
      onSelectCoin(coin)
      onValueChange("")
      setOpen(false)
    },
    [onSelectCoin, onValueChange],
  )

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9AA0A6] pointer-events-none z-10"
          aria-hidden="true"
        />
        <Input
          aria-label="Search leverage pairs"
          placeholder="Search pairs (e.g., BTC)"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAddFirstMatch()
            } else if (e.key === "Escape") {
              onValueChange("")
              setOpen(false)
            }
          }}
          className="w-full pl-10 pr-4 py-2 bg-[#1E1E1E] border border-[#3C4043] text-[#E3E3E3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8C7FA] focus:border-transparent h-10 text-sm"
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <div className="bg-[#292A2D] rounded-lg border border-[#3C4043] shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#9AA0A6]">No leverage pairs found</div>
              ) : (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-[#9AA0A6] uppercase tracking-wide">
                    Leverage Pairs
                  </div>
                  {filtered.map((coin) => (
                    <button
                      key={coin.symbol}
                      onClick={() => handleSelectCoin(coin)}
                      className="w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-[#3C4043] focus:outline-none focus:ring-2 focus:ring-[#A8C7FA] focus:ring-inset"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-gradient-to-br from-[#A8C7FA] to-[#00E5FF] text-[#121212] text-xs font-bold grid place-items-center flex-shrink-0">
                          {coin.symbol.split("-")[0].charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-[#E3E3E3] truncate">{coin.symbol}</span>
                          <span className="text-xs text-[#9AA0A6] truncate">{coin.name} • Leverage</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MomentumTracker() {
  const { toast } = useToast()
  const router = useRouter()

  const [watchlistData, setWatchlistData] = useState<WatchlistData>({ sessionStartTime: null, coins: [] })
  const [isTracking, setIsTracking] = useState(false)
  const [momentumTimeframe, setMomentumTimeframe] = useState<MomentumTimeframe>("1m")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [sortBy, setSortBy] = useState<SortField>("momentum")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [query, setQuery] = useState("")
  const [visibleCoins, setVisibleCoins] = useState<Set<string>>(new Set()) // This was in the original code but not in the update, keeping it for now.

  const isUpdatingRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)

  const symbols = useMemo(() => watchlistData.coins.map((c) => c.coinbaseId), [watchlistData.coins])
  const { book } = useCoinbase(symbols)

  const momentumTimeframeMs = useMemo(() => getTimeframeMs(momentumTimeframe), [momentumTimeframe])

  // Connection status
  useEffect(() => {
    if (Object.keys(book).length > 0) {
      setConnectionStatus("connected")
    } else if (symbols.length > 0) {
      setConnectionStatus("connecting")
    } else {
      setConnectionStatus("disconnected")
    }
  }, [book, symbols])

  // Elapsed time tracker
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTracking && watchlistData.sessionStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - watchlistData.sessionStartTime!)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTracking, watchlistData.sessionStartTime])

  // Update coins from WebSocket data
  const updateCoins = useCallback(
    (priceBook: typeof book) => {
      const now = Date.now()
      if (isUpdatingRef.current || now - lastUpdateRef.current < 100) return

      isUpdatingRef.current = true
      lastUpdateRef.current = now

      setWatchlistData((prev) => {
        const coins = prev.coins.map((coin) => {
          const series = priceBook[coin.coinbaseId]
          if (!series || series.length === 0) return coin

          const latest = series[series.length - 1]
          const nextPrice = latest.price

          if (!nextPrice || nextPrice === coin.currentPrice) return coin

          // Add new price point to history (maintain buffer size)
          const history = [...coin.priceHistory.slice(-OPTIMAL_BUFFER_SIZE + 1), { price: nextPrice, timestamp: now }]

          const sessionROC = calculateSessionROC(nextPrice, coin.sessionStartPrice)
          const momentum = calculateMomentum(history, momentumTimeframeMs)

          // Debug insufficient data
          if (!hasSufficientData(history, momentumTimeframeMs)) {
            console.warn(`Insufficient data for ${coin.symbol}`, {
              timeframe: momentumTimeframe,
              bufferSize: history.length,
              coverage: history.length > 1 ? history[history.length - 1].timestamp - history[0].timestamp : 0,
            })
          }

          return {
            ...coin,
            currentPrice: nextPrice,
            sessionROC,
            momentum,
            lastUpdated: now,
            priceHistory: history,
          }
        })

        isUpdatingRef.current = false
        return { ...prev, coins }
      })
    },
    [momentumTimeframeMs, momentumTimeframe],
  )

  useEffect(() => {
    if (Object.keys(book).length > 0) {
      updateCoins(book)
    }
  }, [book, updateCoins])

  const addCoin = useCallback(
    (coinInfo: (typeof LEVERAGE_PAIRS)[number]) => {
      if (watchlistData.coins.some((c) => c.symbol === coinInfo.symbol)) {
        toast({ title: "Already added", description: `${coinInfo.symbol} is already in your watchlist.` })
        return
      }

      const series = book[coinInfo.coinbaseId]
      const currentPrice = series && series.length > 0 ? series[series.length - 1].price : 0
      const now = Date.now()

      const newCoin: CoinData = {
        id: generateCoinId(coinInfo.symbol),
        symbol: coinInfo.symbol,
        name: coinInfo.name,
        coinbaseId: coinInfo.coinbaseId,
        currentPrice,
        sessionStartPrice: currentPrice,
        sessionStartTime: now, // Each coin tracks from when it was added
        sessionROC: 0,
        momentum: 0,
        lastUpdated: now,
        priceHistory: [{ price: currentPrice, timestamp: now }],
      }

      setWatchlistData((prev) => ({
        ...prev,
        coins: [...prev.coins, newCoin],
      }))

      // Add to visible coins by default if not already there (to show in chart)
      setVisibleCoins((prev) => {
        const newSet = new Set(prev)
        if (!newSet.has(newCoin.id)) {
          newSet.add(newCoin.id)
        }
        return newSet
      })

      toast({ title: "Pair added", description: `${coinInfo.symbol} added to watchlist.` })
    },
    [book, watchlistData.coins, toast],
  )

  const addFirstMatch = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) return

    const match = LEVERAGE_PAIRS.find(
      (c) =>
        !watchlistData.coins.some((x) => x.symbol === c.symbol) &&
        (c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    )
    if (match) {
      addCoin(match)
      setQuery("")
    } else {
      toast({ title: "No match found", description: "Try a different symbol or name." })
    }
  }, [query, watchlistData.coins, addCoin, toast])

  const removeCoin = useCallback(
    (id: string) => {
      const removed = watchlistData.coins.find((c) => c.id === id)
      setWatchlistData((prev) => ({ ...prev, coins: prev.coins.filter((c) => c.id !== id) }))
      setVisibleCoins((prev) => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      if (removed) toast({ title: "Removed", description: `${removed.symbol} removed from watchlist.` })
    },
    [watchlistData.coins, toast],
  )

  const startRace = useCallback(() => {
    const now = Date.now()
    setWatchlistData((prev) => ({
      sessionStartTime: now,
      coins: prev.coins.map((c) => ({
        ...c,
        sessionStartPrice: c.currentPrice,
        sessionStartTime: now, // Reset all to same start time
        sessionROC: 0,
        momentum: 0,
        priceHistory: [{ price: c.currentPrice, timestamp: now }],
      })),
    }))
    setIsTracking(true)
    setElapsedTime(0)
    toast({ title: "Race started", description: "All coins tracking from this moment." })
  }, [toast])

  const stopRace = useCallback(() => {
    setIsTracking(false)
    toast({ title: "Race stopped" })
  }, [toast])

  const resetTracking = useCallback(() => {
    setWatchlistData((prev) => ({
      ...prev,
      sessionStartTime: null,
      coins: prev.coins.map((c) => ({
        ...c,
        sessionStartPrice: 0,
        sessionStartTime: 0,
        sessionROC: 0,
        momentum: 0,
        priceHistory: [],
      })),
    }))
    setIsTracking(false)
    setElapsedTime(0)
    toast({ title: "Tracking reset", description: "Start a new race when ready." })
  }, [toast])

  const handleCoinClick = useCallback(
    (coin: CoinData) => {
      router.push(`/coin/${coin.symbol.split("-")[0].toLowerCase()}`)
    },
    [router],
  )

  const toggleCoinVisibility = useCallback((coinId: string) => {
    setVisibleCoins((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(coinId)) {
        newSet.delete(coinId)
      } else {
        newSet.add(coinId)
      }
      return newSet
    })
  }, [])

  const filteredCoins = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return watchlistData.coins
    return watchlistData.coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  }, [watchlistData.coins, query])

  const sortedCoins = useMemo(() => {
    return [...filteredCoins].sort((a, b) => {
      switch (sortBy) {
        case "momentum":
          return Math.abs(b.momentum) - Math.abs(a.momentum)
        case "sessionROC":
          return b.sessionROC - a.sessionROC
        case "currentPrice":
          return b.currentPrice - a.currentPrice
        default:
          return Math.abs(b.momentum) - Math.abs(a.momentum)
      }
    })
  }, [filteredCoins, sortBy])

  const bestPerformer = useMemo(() => sortedCoins[0], [sortedCoins])
  const fastestMover = useMemo(
    () => [...sortedCoins].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))[0],
    [sortedCoins],
  )

  // Top 3 fastest movers for highlighting
  const topMovers = useMemo(() => {
    return [...sortedCoins].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum)).slice(0, 3)
  }, [sortedCoins])

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-[#E3E3E3] overflow-hidden">
      {/* Header - Fixed */}
      <header className="flex-shrink-0 border-b border-[#3C4043] bg-[#1E1E1E]/95 backdrop-blur-sm shadow-lg z-40">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-3 md:gap-6 min-w-0">
              <Brand />
              <div className="hidden sm:flex items-center gap-2 md:gap-3">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connectionStatus === "connected"
                      ? "bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                      : connectionStatus === "connecting"
                        ? "bg-[#FFAE2B] animate-pulse"
                        : "bg-[#5F6368]"
                  }`}
                  aria-label={`Connection status: ${connectionStatus}`}
                />
                <Badge
                  className={`text-xs ${isTracking ? "bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/30" : "bg-[#3C4043] text-[#9AA0A6] border-[#5F6368]"}`}
                >
                  {isTracking ? "Tracking" : "Ready"}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              {!isTracking ? (
                <Button
                  onClick={startRace}
                  disabled={watchlistData.coins.length === 0}
                  className="bg-[#00E5FF] hover:bg-[#00B8CC] text-[#121212] px-3 md:px-4 py-2 h-9 text-sm font-medium rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  aria-label="Start momentum race"
                >
                  <Flag className="mr-1 md:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Start</span>
                </Button>
              ) : (
                <Button
                  onClick={stopRace}
                  className="bg-[#FF4D6D] hover:bg-[#E63950] text-white px-3 md:px-4 py-2 h-9 text-sm font-medium rounded-lg shadow-lg transition-all"
                  aria-label="Stop momentum race"
                >
                  <Pause className="mr-1 md:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={resetTracking}
                disabled={!isTracking}
                className="hidden sm:flex px-3 md:px-4 py-2 h-9 bg-[#1E1E1E] text-[#9AA0A6] hover:bg-[#292A2D] hover:text-[#E3E3E3] border border-[#3C4043] text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                aria-label="Reset tracking"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-4 md:py-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg overflow-hidden">
              <CardHeader className="pb-2 pt-3 md:pt-4">
                <div className="flex items-center justify-center mb-1 md:mb-2">
                  <Activity className="h-4 w-4 md:h-5 md:w-5 text-[#A8C7FA]" aria-hidden="true" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium text-[#9AA0A6] text-center">
                  Leverage Pairs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 md:pb-4 text-center">
                <div className="text-xl md:text-2xl font-bold text-[#E3E3E3]">{watchlistData.coins.length}</div>
              </CardContent>
            </Card>

            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg overflow-hidden">
              <CardHeader className="pb-2 pt-3 md:pt-4">
                <div className="flex items-center justify-center mb-1 md:mb-2">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-[#00E5FF]" aria-hidden="true" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium text-[#9AA0A6] text-center">
                  Session Time
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 md:pb-4 text-center">
                <div className="text-xl md:text-2xl font-bold text-[#E3E3E3] font-mono">
                  {isTracking ? formatElapsedTime(elapsedTime) : "0:00"}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg overflow-hidden ${bestPerformer ? "ring-2 ring-[#00E5FF]/30" : ""}`}
            >
              <CardHeader className="pb-2 pt-3 md:pt-4">
                <div className="flex items-center justify-center mb-1 md:mb-2">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-[#00E5FF]" aria-hidden="true" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium text-[#9AA0A6] text-center">
                  Session Leader
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 md:pb-4 text-center">
                <div className="text-xl md:text-2xl font-bold text-[#E3E3E3] truncate">
                  {bestPerformer?.symbol.split("-")[0] || "N/A"}
                </div>
                {bestPerformer && (
                  <div className="text-xs md:text-sm text-[#00E5FF] font-semibold mt-1">
                    {formatPercentage(bestPerformer.sessionROC)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card
              className={`bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg overflow-hidden ${fastestMover ? "ring-2 ring-[#FFAE2B]/30" : ""}`}
            >
              <CardHeader className="pb-2 pt-3 md:pt-4">
                <div className="flex items-center justify-center mb-1 md:mb-2">
                  <Zap className="h-4 w-4 md:h-5 md:w-5 text-[#FFAE2B]" aria-hidden="true" />
                </div>
                <CardTitle className="text-xs md:text-sm font-medium text-[#9AA0A6] text-center">
                  Fastest Mover
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 md:pb-4 text-center">
                <div className="text-xl md:text-2xl font-bold text-[#E3E3E3] truncate">
                  {fastestMover?.symbol.split("-")[0] || "N/A"}
                </div>
                {fastestMover && (
                  <div className="text-xs md:text-sm text-[#9AA0A6] font-semibold mt-1">
                    {Math.abs(fastestMover.momentum).toFixed(2)}%/{momentumTimeframe}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Watchlist Table & Chart Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "table" | "chart")} className="space-y-4">
            <TabsList className="bg-transparent p-0 mb-4 h-auto flex-wrap justify-center md:justify-start gap-2 border-b border-[#3C4043] data-[state=active]:shadow-none">
              <TabsTrigger
                value="table"
                className="relative px-4 py-2 text-sm font-medium text-[#9AA0A6] rounded-none border-b-2 border-transparent transition-colors duration-200 ease-in-out hover:text-[#E3E3E3] focus:outline-none data-[state=active]:text-[#00E5FF] data-[state=active]:border-b-[#00E5FF]"
              >
                <LayoutList className="mr-2 h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger
                value="chart"
                className="relative px-4 py-2 text-sm font-medium text-[#9AA0A6] rounded-none border-b-2 border-transparent transition-colors duration-200 ease-in-out hover:text-[#E3E3E3] focus:outline-none data-[state=active]:text-[#00E5FF] data-[state=active]:border-b-[#00E5FF]"
              >
                <LineChart className="mr-2 h-4 w-4" />
                Chart
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#3C4043] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0 flex-1">
                      <MomentumTimeframeSelector
                        timeframe={momentumTimeframe}
                        onTimeframeChange={setMomentumTimeframe}
                      />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="bg-[#1E1E1E] border-[#3C4043] text-[#E3E3E3] hover:bg-[#292A2D] hover:text-[#E3E3E3] h-9 text-xs md:text-sm w-full sm:w-auto"
                            aria-label="Change sort order"
                          >
                            <span className="truncate">
                              Sort:{" "}
                              {sortBy === "momentum" ? "Momentum" : sortBy === "sessionROC" ? "Session %" : "Price"}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#292A2D] border-[#3C4043]">
                          <DropdownMenuItem
                            onClick={() => setSortBy("momentum")}
                            className={`text-[#E3E3E3] hover:bg-[#3C4043] focus:bg-[#3C4043] ${sortBy === "momentum" ? "bg-[#A8C7FA]/20 text-[#A8C7FA]" : ""}`}
                          >
                            Fastest Movers (Momentum)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSortBy("sessionROC")}
                            className={`text-[#E3E3E3] hover:bg-[#3C4043] focus:bg-[#3C4043] ${sortBy === "sessionROC" ? "bg-[#A8C7FA]/20 text-[#A8C7FA]" : ""}`}
                          >
                            Session Performance
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSortBy("currentPrice")}
                            className={`text-[#E3E3E3] hover:bg-[#3C4043] focus:bg-[#3C4043] ${sortBy === "currentPrice" ? "bg-[#A8C7FA]/20 text-[#A8C7FA]" : ""}`}
                          >
                            Current Price
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <div className="flex-1 md:flex-initial md:w-64">
                        <AddCoinTypeahead
                          value={query}
                          onValueChange={setQuery}
                          existingSymbols={watchlistData.coins.map((c) => c.symbol)}
                          onSelectCoin={addCoin}
                          onAddFirstMatch={addFirstMatch}
                        />
                      </div>
                      <Button
                        onClick={addFirstMatch}
                        className="flex-shrink-0 bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#121212] px-3 md:px-4 py-2 h-10 text-sm font-medium rounded-lg shadow-lg transition-all"
                        aria-label="Add selected coin"
                      >
                        <Plus className="h-4 w-4 md:mr-2" aria-hidden="true" />
                        <span className="hidden md:inline">Add</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  {sortedCoins.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-[#1E1E1E] sticky top-0 z-10">
                          <TableRow className="border-[#3C4043] hover:bg-transparent">
                            <TableHead className="text-[#9AA0A6] font-semibold text-xs md:text-sm">Asset</TableHead>
                            <TableHead className="text-right text-[#9AA0A6] font-semibold text-xs md:text-sm">
                              Price
                            </TableHead>
                            <TableHead className="text-right text-[#9AA0A6] font-semibold text-xs md:text-sm">
                              Session %
                            </TableHead>
                            <TableHead className="text-right text-[#9AA0A6] font-semibold text-xs md:text-sm">
                              Momentum ({momentumTimeframe})
                            </TableHead>
                            <TableHead className="text-center text-[#9AA0A6] font-semibold text-xs md:text-sm w-16">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedCoins.map((coin, index) => {
                            const isTopMover = topMovers.includes(coin)
                            const topMoverRank = topMovers.indexOf(coin)
                            return (
                              <TableRow
                                key={coin.id}
                                className={`border-[#3C4043] cursor-pointer transition-colors hover:bg-[#292A2D] ${
                                  isTopMover
                                    ? topMoverRank === 0
                                      ? "bg-[#FFAE2B]/10 ring-1 ring-inset ring-[#FFAE2B]/40"
                                      : topMoverRank === 1
                                        ? "bg-[#A8C7FA]/10 ring-1 ring-inset ring-[#A8C7FA]/30"
                                        : "bg-[#00E5FF]/10 ring-1 ring-inset ring-[#00E5FF]/20"
                                    : ""
                                }`}
                                onClick={() => handleCoinClick(coin)}
                                tabIndex={0}
                                role="button"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    handleCoinClick(coin)
                                  }
                                }}
                                aria-label={`View details for ${coin.name}`}
                              >
                                <TableCell className="py-3 md:py-4">
                                  <div className="flex items-center gap-2 md:gap-3">
                                    <div className="relative flex-shrink-0">
                                      <div
                                        className="size-6 md:size-8 rounded-full grid place-items-center text-[#121212] text-xs md:text-sm font-bold"
                                        style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                                        aria-hidden="true"
                                      >
                                        {coin.symbol.split("-")[0].charAt(0)}
                                      </div>
                                      {isTopMover && (
                                        <div
                                          className="absolute -top-1 -right-1 size-3 md:size-4 rounded-full bg-[#FFAE2B] flex items-center justify-center"
                                          aria-label={`Top ${topMoverRank + 1} mover`}
                                        >
                                          <Flame
                                            className="h-2 w-2 md:h-2.5 md:w-2.5 text-[#121212]"
                                            aria-hidden="true"
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-bold text-sm md:text-base text-[#E3E3E3] truncate">
                                        {coin.symbol.split("-")[0]}
                                      </div>
                                      <div className="text-xs text-[#9AA0A6] truncate">{coin.name}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-[#E3E3E3] text-sm md:text-base font-semibold py-3 md:py-4">
                                  ${formatPrice(coin.currentPrice)}
                                </TableCell>
                                <TableCell className="text-right py-3 md:py-4">
                                  <span
                                    className={`font-bold text-sm md:text-base ${
                                      coin.sessionROC > 0
                                        ? "text-[#00E5FF]"
                                        : coin.sessionROC < 0
                                          ? "text-[#FF4D6D]"
                                          : "text-[#9AA0A6]"
                                    }`}
                                  >
                                    {watchlistData.sessionStartTime ? formatPercentage(coin.sessionROC) : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right py-3 md:py-4">
                                  <div className="inline-flex items-center gap-1 md:gap-2">
                                    {Math.abs(coin.momentum) > 0.1 &&
                                      (coin.momentum > 0 ? (
                                        <TrendingUp
                                          className="h-3 w-3 md:h-4 md:w-4 text-[#00E5FF]"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <TrendingDown
                                          className="h-3 w-3 md:h-4 md:w-4 text-[#FF4D6D]"
                                          aria-hidden="true"
                                        />
                                      ))}
                                    <span
                                      className={`text-sm md:text-base font-bold ${
                                        Math.abs(coin.momentum) > 0.5
                                          ? coin.momentum > 0
                                            ? "text-[#00E5FF]"
                                            : "text-[#FF4D6D]"
                                          : "text-[#9AA0A6]"
                                      }`}
                                    >
                                      {Math.abs(coin.momentum).toFixed(2)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-3 md:py-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeCoin(coin.id)
                                    }}
                                    className="text-[#9AA0A6] hover:text-[#FF4D6D] hover:bg-[#FF4D6D]/10 h-7 w-7 md:h-8 md:w-8 p-0 focus:outline-none focus:ring-2 focus:ring-[#A8C7FA] focus:ring-offset-2 focus:ring-offset-[#121212]"
                                    aria-label={`Remove ${coin.name} from watchlist`}
                                  >
                                    <X className="h-3 w-3 md:h-4 md:w-4" aria-hidden="true" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-12 md:py-16 text-center px-4">
                      <div className="mx-auto size-12 md:size-16 rounded-full bg-[#292A2D] grid place-items-center mb-3 md:mb-4">
                        <Plus className="h-5 w-5 md:h-7 md:w-7 text-[#9AA0A6]" aria-hidden="true" />
                      </div>
                      <h3 className="text-base md:text-lg font-medium text-[#E3E3E3] mb-1 md:mb-2">
                        Add Leverage Pairs
                      </h3>
                      <p className="text-[#9AA0A6] text-xs md:text-sm">
                        Search and add leverage trading pairs to get started.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chart">
              <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-xl overflow-hidden">
                <CardHeader className="border-b border-[#3C4043] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        onClick={() => setActiveTab("table")}
                        className="text-[#9AA0A6] hover:text-[#E3E3E3] h-9 px-3 py-2"
                        aria-label="Go back to table view"
                      >
                        ← Back to Table
                      </Button>
                      <div>
                        <CardTitle className="text-base md:text-lg font-bold text-[#E3E3E3]">
                          Session Performance Chart
                        </CardTitle>
                        <CardDescription className="text-[#9AA0A6] text-xs md:text-sm">
                          % change since session start
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[40rem] p-0">
                  <RaceChart
                    coins={sortedCoins}
                    startTime={watchlistData.sessionStartTime}
                    visibleCoins={visibleCoins}
                    onToggleCoin={toggleCoinVisibility}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

// Chart Component (Moved from original location)
function RaceChart({
  coins,
  startTime,
  visibleCoins,
  onToggleCoin,
}: {
  coins: CoinData[]
  startTime: number | null
  visibleCoins: Set<string>
  onToggleCoin: (coinId: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !startTime || coins.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const padding = 40
    const w = rect.width - padding * 2
    const h = rect.height - padding * 2

    const visibleCoinData = coins.filter((c) => visibleCoins.has(c.id))
    const all = visibleCoinData.flatMap((c) =>
      c.priceHistory
        .filter((p) => p.timestamp >= c.sessionStartTime)
        .map((p) => {
          return ((p.price - c.sessionStartPrice) / c.sessionStartPrice) * 100
        }),
    )
    if (!all.length) return

    const min = Math.min(...all)
    const max = Math.max(...all)
    const absMax = Math.max(Math.abs(min), Math.abs(max))

    let range = 0.2
    if (absMax > 0.1) range = 0.4
    if (absMax > 0.2) range = absMax * 2.2

    const yMin = -range / 2
    const yMax = range / 2

    // Grid lines
    ctx.strokeStyle = "var(--border)" // Using a CSS variable for color
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * h
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + w, y)
      ctx.stroke()
      const v = yMax - (i / 5) * range
      ctx.fillStyle = "var(--text-muted)" // Using a CSS variable for color
      ctx.font = "10px Inter, ui-monospace, SFMono-Regular, Menlo, monospace"
      ctx.textAlign = "right"
      ctx.fillText(`${v.toFixed(2)}%`, padding - 6, y + 3)
    }

    // Zero line
    const zeroY = padding + h / 2
    ctx.setLineDash([])
    ctx.strokeStyle = "var(--text-muted)" // Using a CSS variable for color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(padding + w, zeroY)
    ctx.stroke()

    // Draw series
    visibleCoinData.forEach((coin, idx) => {
      const series = coin.priceHistory.filter((p) => p.timestamp >= coin.sessionStartTime)
      if (series.length < 2) return
      const color = COIN_COLORS[coins.indexOf(coin) % COIN_COLORS.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2

      ctx.beginPath()
      series.forEach((pt, i) => {
        const sessionROC = ((pt.price - coin.sessionStartPrice) / coin.sessionStartPrice) * 100
        const x = padding + (i / (series.length - 1)) * w
        const y = padding + ((yMax - sessionROC) / range) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // End dot + label
      const last = series[series.length - 1]
      const x = padding + w
      const sessionROC = ((last.price - coin.sessionStartPrice) / coin.sessionStartPrice) * 100
      const y = padding + ((yMax - sessionROC) / range) * h
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = "var(--text)" // Using a CSS variable for color
      ctx.font = "12px Inter, ui-sans-serif, system-ui"
      ctx.textAlign = "left"
      ctx.fillText(`${coin.symbol.split("-")[0]}`, x + 8, y + 4)
    })
  }, [coins, startTime, visibleCoins])

  // No longer rendering the "Start a race" message here, it's handled by the TabContent for chart
  // The initial render state for the chart tab should be handled by the parent component or a loading state.

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        <div className="border-t border-[var(--border)] p-4">
          <div className="flex flex-wrap gap-2">
            {coins.map((coin, idx) => (
              <button
                key={coin.id}
                onClick={() => onToggleCoin(coin.id)}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm transition-all ${
                  visibleCoins.has(coin.id)
                    ? "bg-[var(--surface-2)] text-[var(--text)]"
                    : "bg-[var(--surface-hover)] text-[var(--text-muted)] opacity-50"
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COIN_COLORS[idx % COIN_COLORS.length] }}
                />
                {coin.symbol.split("-")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
