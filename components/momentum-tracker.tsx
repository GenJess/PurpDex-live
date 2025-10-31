"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

const COIN_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#14b8a6", // Teal
]

const OPTIMAL_BUFFER_SIZE = getOptimalBufferSize()

// Brand logo
function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] flex items-center justify-center text-white font-bold text-base shadow-md">
        PD
      </div>
      <div className="leading-tight">
        <div className="text-base font-semibold text-[var(--text)]">PurpDex</div>
        <div className="text-xs text-[var(--text-muted)]">Live Leverage Tracker</div>
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
    <div className="flex items-center gap-1 bg-[var(--surface-2)] rounded-lg p-1 border border-[var(--border)]">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-3 py-1.5 rounded-md text-xs transition-all font-medium ${
            timeframe === tf
              ? "bg-[var(--primary)] text-white shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)]"
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
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none z-10"
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
          className="w-full pl-10 pr-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent h-10 text-sm"
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[200]">
          <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--text-muted)]">No leverage pairs found</div>
              ) : (
                <>
                  <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    Leverage Pairs
                  </div>
                  {filtered.map((coin) => (
                    <button
                      key={coin.symbol}
                      onClick={() => handleSelectCoin(coin)}
                      className="w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-inset"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--info)] text-white text-xs font-bold grid place-items-center flex-shrink-0">
                          {coin.symbol.split("-")[0].charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium text-[var(--text)] truncate">{coin.symbol}</span>
                          <span className="text-xs text-[var(--text-muted)] truncate">{coin.name} • Leverage</span>
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
  const [visibleCoins, setVisibleCoins] = useState<Set<string>>(new Set())
  const [previousPositions, setPreviousPositions] = useState<Map<string, number>>(new Map())

  const isUpdatingRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)
  const chartUpdateTimeoutRef = useRef<NodeJS.Timeout>()
  const [debouncedChartData, setDebouncedChartData] = useState<CoinData[]>([])

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

  const filteredCoins = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return watchlistData.coins

    // Filter coins but maintain stability
    return watchlistData.coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  }, [watchlistData.coins, query])

  const sortedCoins = useMemo(() => {
    const sorted = [...filteredCoins].sort((a, b) => {
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

    const newPositions = new Map<string, number>()
    sorted.forEach((coin, index) => {
      newPositions.set(coin.id, index)
    })

    // Only update if positions actually changed
    if (sorted.length > 0) {
      setPreviousPositions(newPositions)
    }

    return sorted
  }, [filteredCoins, sortBy])

  useEffect(() => {
    if (chartUpdateTimeoutRef.current) {
      clearTimeout(chartUpdateTimeoutRef.current)
    }

    chartUpdateTimeoutRef.current = setTimeout(() => {
      setDebouncedChartData(sortedCoins)
    }, 150)

    return () => {
      if (chartUpdateTimeoutRef.current) {
        clearTimeout(chartUpdateTimeoutRef.current)
      }
    }
  }, [sortedCoins])

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
        sessionStartTime: now,
        sessionROC: 0,
        momentum: 0,
        lastUpdated: now,
        priceHistory: [{ price: currentPrice, timestamp: now }],
      }

      setWatchlistData((prev) => ({
        ...prev,
        coins: [...prev.coins, newCoin],
      }))

      setTimeout(() => setQuery(""), 150)

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
        newSet.delete(coinId) // Corrected from `id` to `coinId`
      } else {
        newSet.add(coinId)
      }
      return newSet
    })
  }, [])

  const bestPerformer = useMemo(() => sortedCoins[0], [sortedCoins])
  const fastestMover = useMemo(
    () => [...sortedCoins].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))[0],
    [sortedCoins],
  )

  const topMovers = useMemo(() => {
    return [...sortedCoins].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum)).slice(0, 3)
  }, [sortedCoins])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Header - Fixed */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm shadow-sm z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <Brand />
              <div className="hidden sm:flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connectionStatus === "connected"
                      ? "bg-[var(--success)] shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                      : connectionStatus === "connecting"
                        ? "bg-[var(--warning)] animate-pulse"
                        : "bg-[var(--text-muted)]"
                  }`}
                  aria-label={`Connection status: ${connectionStatus}`}
                />
                <Badge
                  className={`text-xs ${isTracking ? "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30" : "bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]"}`}
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
                  className="bg-[var(--success)] hover:bg-[var(--success)]/90 text-white px-4 py-2 h-9 text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  aria-label="Start momentum race"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Start</span>
                </Button>
              ) : (
                <Button
                  onClick={stopRace}
                  className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white px-4 py-2 h-9 text-sm font-medium rounded-lg shadow-sm transition-all"
                  aria-label="Stop momentum race"
                >
                  <Pause className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={resetTracking}
                disabled={!isTracking}
                className="hidden sm:flex px-4 py-2 h-9 bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-[var(--border)] text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-4 gap-3 mb-6">
            <Card className="neon-card border border-[var(--border)]">
              <CardContent className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Pairs</span>
                </div>
                <div className="text-xl font-semibold text-[var(--text)]">{watchlistData.coins.length}</div>
              </CardContent>
            </Card>

            <Card className="neon-card border border-[var(--border)]">
              <CardContent className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-[var(--info)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Time</span>
                </div>
                <div className="text-xl font-semibold text-[var(--text)] font-mono tabular-nums">
                  {isTracking ? formatElapsedTime(elapsedTime) : "0:00"}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`neon-card border ${bestPerformer ? "border-[var(--success)] ring-1 ring-[var(--success)]/20" : "border-[var(--border)]"}`}
            >
              <CardContent className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Trophy className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Leader</span>
                </div>
                <div className="text-xl font-semibold text-[var(--text)] truncate">
                  {bestPerformer?.symbol.split("-")[0] || "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card
              className={`neon-card border ${fastestMover ? "border-[var(--warning)] ring-1 ring-[var(--warning)]/20" : "border-[var(--border)]"}`}
            >
              <CardContent className="py-3 px-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-[var(--warning)]" aria-hidden="true" />
                  <span className="text-xs font-medium text-[var(--text-muted)]">Fastest</span>
                </div>
                <div className="text-xl font-semibold text-[var(--text)] truncate">
                  {fastestMover?.symbol.split("-")[0] || "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Watchlist Table & Chart Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "table" | "chart")} className="space-y-4">
            <TabsList className="bg-[var(--surface-2)] p-1 h-auto rounded-lg border border-[var(--border)]">
              <TabsTrigger
                value="table"
                className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--text)] data-[state=active]:shadow-sm transition-all"
              >
                <LayoutList className="mr-2 h-4 w-4" />
                Table
              </TabsTrigger>
              <TabsTrigger
                value="chart"
                className="px-4 py-2 text-sm font-medium rounded-md data-[state=active]:bg-[var(--surface)] data-[state=active]:text-[var(--text)] data-[state=active]:shadow-sm transition-all"
              >
                <LineChart className="mr-2 h-4 w-4" />
                Chart
              </TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Card className="bg-[var(--surface)] border-[var(--border)] rounded-lg shadow-md overflow-hidden">
                <CardHeader className="border-b border-[var(--border)] p-4">
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
                            className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)] h-9 text-sm w-full sm:w-auto"
                            aria-label="Change sort order"
                          >
                            <span className="truncate">
                              Sort:{" "}
                              {sortBy === "momentum" ? "Momentum" : sortBy === "sessionROC" ? "Session %" : "Price"}
                            </span>
                            <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[var(--surface)] border-[var(--border)]">
                          <DropdownMenuItem
                            onClick={() => setSortBy("momentum")}
                            className={`text-[var(--text)] hover:bg-[var(--surface-hover)] ${sortBy === "momentum" ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""}`}
                          >
                            Fastest Movers (Momentum)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSortBy("sessionROC")}
                            className={`text-[var(--text)] hover:bg-[var(--surface-hover)] ${sortBy === "sessionROC" ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""}`}
                          >
                            Session Performance
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSortBy("currentPrice")}
                            className={`text-[var(--text)] hover:bg-[var(--surface-hover)] ${sortBy === "currentPrice" ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""}`}
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
                        className="flex-shrink-0 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-4 py-2 h-10 text-sm font-medium rounded-lg shadow-sm transition-all"
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
                        <TableHeader className="bg-[var(--surface-2)] sticky top-0 z-10">
                          <TableRow className="border-[var(--border)] hover:bg-transparent">
                            <TableHead className="text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide w-20">
                              Place
                            </TableHead>
                            <TableHead className="text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide">
                              Asset
                            </TableHead>
                            <TableHead className="text-right text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide w-32">
                              Price
                            </TableHead>
                            <TableHead className="text-right text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide w-28">
                              Session %
                            </TableHead>
                            <TableHead className="text-right text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide w-32">
                              Momentum ({momentumTimeframe})
                            </TableHead>
                            <TableHead className="text-center text-[var(--text-muted)] font-semibold text-xs uppercase tracking-wide w-16">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedCoins.map((coin, index) => {
                            const isTopMover = topMovers.includes(coin)
                            const topMoverRank = topMovers.indexOf(coin)
                            const previousPosition = previousPositions.get(coin.id)
                            const positionChange = previousPosition !== undefined ? previousPosition - index : 0

                            return (
                              <TableRow
                                key={coin.id}
                                className={`border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--surface-hover)] ${
                                  isTopMover
                                    ? topMoverRank === 0
                                      ? "bg-[var(--warning)]/5 ring-1 ring-inset ring-[var(--warning)]/20"
                                      : topMoverRank === 1
                                        ? "bg-[var(--primary)]/5 ring-1 ring-inset ring-[var(--primary)]/20"
                                        : "bg-[var(--info)]/5 ring-1 ring-inset ring-[var(--info)]/20"
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
                                <TableCell className="py-3 px-4 w-20">
                                  <div className="flex items-center gap-2">
                                    <div className="text-base font-semibold text-[var(--text-muted)] w-6 text-center">
                                      #{index + 1}
                                    </div>
                                    {positionChange !== 0 && (
                                      <div
                                        className={`flex items-center gap-0.5 text-xs font-semibold ${
                                          positionChange > 0
                                            ? "text-[var(--success)] animate-pulse"
                                            : "text-[var(--danger)] animate-pulse"
                                        }`}
                                      >
                                        {positionChange > 0 ? "↑" : "↓"}
                                        {Math.abs(positionChange)}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="relative flex-shrink-0">
                                      <div
                                        className="size-9 rounded-full grid place-items-center text-white text-sm font-bold shadow-sm"
                                        style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                                        aria-hidden="true"
                                      >
                                        {coin.symbol.split("-")[0].charAt(0)}
                                      </div>
                                      {isTopMover && (
                                        <div
                                          className="absolute -top-1 -right-1 size-4 rounded-full bg-[var(--warning)] flex items-center justify-center shadow-sm"
                                          aria-label={`Top ${topMoverRank + 1} mover`}
                                        >
                                          <Flame className="h-2.5 w-2.5 text-white" aria-hidden="true" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-base text-[var(--text)] truncate">
                                        {coin.symbol.split("-")[0]}
                                      </div>
                                      <div className="text-xs text-[var(--text-muted)] truncate">{coin.name}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-[var(--text)] text-sm font-medium py-3 px-4 w-32 tabular-nums">
                                  ${formatPrice(coin.currentPrice)}
                                </TableCell>
                                <TableCell className="text-right py-3 px-4 w-28">
                                  <span
                                    className={`font-semibold text-sm tabular-nums ${
                                      coin.sessionROC > 0
                                        ? "text-[var(--success)]"
                                        : coin.sessionROC < 0
                                          ? "text-[var(--danger)]"
                                          : "text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {watchlistData.sessionStartTime ? formatPercentage(coin.sessionROC) : "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right py-3 px-4 w-32">
                                  <div className="inline-flex items-center gap-2">
                                    {Math.abs(coin.momentum) > 0.1 &&
                                      (coin.momentum > 0 ? (
                                        <TrendingUp className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
                                      ) : (
                                        <TrendingDown className="h-4 w-4 text-[var(--danger)]" aria-hidden="true" />
                                      ))}
                                    <span
                                      className={`text-sm font-semibold tabular-nums ${
                                        Math.abs(coin.momentum) > 0.5
                                          ? coin.momentum > 0
                                            ? "text-[var(--success)]"
                                            : "text-[var(--danger)]"
                                          : "text-[var(--text-muted)]"
                                      }`}
                                    >
                                      {Math.abs(coin.momentum).toFixed(2)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center py-3 px-4 w-16">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removeCoin(coin.id)
                                    }}
                                    className="text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 h-8 w-8 p-0"
                                    aria-label={`Remove ${coin.name} from watchlist`}
                                  >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-16 text-center px-4">
                      <div className="mx-auto size-16 rounded-full bg-[var(--surface-2)] grid place-items-center mb-4">
                        <Plus className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-medium text-[var(--text)] mb-2">
                        {query ? "No matching pairs" : "Add Leverage Pairs"}
                      </h3>
                      <p className="text-[var(--text-muted)] text-sm">
                        {query
                          ? "Try a different search term"
                          : "Search and add leverage trading pairs to get started."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chart">{/* ... existing chart code ... */}</TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

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
    ctx.strokeStyle = "rgba(156, 107, 255, 0.1)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * h
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + w, y)
      ctx.stroke()
      const v = yMax - (i / 5) * range
      ctx.fillStyle = "rgba(233, 237, 246, 0.5)"
      ctx.font = "10px Inter, ui-monospace, SFMono-Regular, Menlo, monospace"
      ctx.textAlign = "right"
      ctx.fillText(`${v.toFixed(2)}%`, padding - 6, y + 3)
    }

    // Zero line
    const zeroY = padding + h / 2
    ctx.setLineDash([])
    ctx.strokeStyle = "rgba(156, 107, 255, 0.3)"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(padding + w, zeroY)
    ctx.stroke()

    visibleCoinData.forEach((coin, idx) => {
      const series = coin.priceHistory.filter((p) => p.timestamp >= coin.sessionStartTime)
      if (series.length < 2) return
      const color = COIN_COLORS[coins.indexOf(coin) % COIN_COLORS.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5

      ctx.beginPath()
      series.forEach((pt, i) => {
        const sessionROC = ((pt.price - coin.sessionStartPrice) / coin.sessionStartPrice) * 100
        const x = padding + (i / (series.length - 1)) * w
        const y = padding + ((yMax - sessionROC) / range) * h

        if (i === 0) {
          ctx.moveTo(x, y)
        } else if (i === 1) {
          // First segment uses simple line
          ctx.lineTo(x, y)
        } else {
          // Use bezier curves for smooth interpolation
          const prevPt = series[i - 1]
          const prevSessionROC = ((prevPt.price - coin.sessionStartPrice) / coin.sessionStartPrice) * 100
          const prevX = padding + ((i - 1) / (series.length - 1)) * w
          const prevY = padding + ((yMax - prevSessionROC) / range) * h

          // Control points for smooth curve
          const cpX1 = prevX + (x - prevX) * 0.33
          const cpY1 = prevY
          const cpX2 = prevX + (x - prevX) * 0.67
          const cpY2 = y

          ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, x, y)
        }
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
      ctx.fillStyle = "#e9edf6"
      ctx.font = "12px Inter, ui-sans-serif, system-ui"
      ctx.textAlign = "left"
      ctx.fillText(`${coin.symbol.split("-")[0]}`, x + 8, y + 4)
    })
  }, [coins, startTime, visibleCoins])

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
