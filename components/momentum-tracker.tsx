"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCoinbase, type ConnectionStatus } from "@/hooks/use-coinbase"
import { useCoinbaseProducts, type CoinbaseProduct } from "@/hooks/use-coinbase-products"
import { TrendingUp, TrendingDown, Search, Plus, X, RotateCcw, Flag, Pause, Activity, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import {
  calculateMomentum,
  getTimeframeMs,
  getOptimalBufferSize,
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
  sessionStartPrice: number
  sessionStartTime: number
  sessionROC: number
  momentum: number
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
// REMOVED LEVERAGE_PAIRS CONSTANT, using Coinbase Products API instead.

const COIN_COLORS = [
  "#00d4aa", // Cyan-green
  "#00ff88", // Bright green
  "#ffaa00", // Amber
  "#ff5555", // Red
  "#00aaff", // Blue
  "#ff00aa", // Magenta
  "#aaffaa", // Light green
  "#ffff55", // Yellow
]

const OPTIMAL_BUFFER_SIZE = getOptimalBufferSize()

// Brand logo
function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded bg-[hsl(160,100%,40%)] flex items-center justify-center text-black font-bold text-sm font-mono">
        PD
      </div>
      <div className="leading-tight hidden sm:block">
        <div className="text-sm font-semibold text-[hsl(120,10%,85%)] font-mono">PurpDex</div>
        <div className="text-xs text-[hsl(0,0%,55%)]">Live Tracker</div>
      </div>
    </div>
  )
}

function ConnectionIndicator({ status, error }: { status: ConnectionStatus; error: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          status === "connected"
            ? "bg-[hsl(120,60%,45%)] shadow-[0_0_6px_hsl(120,60%,45%)]"
            : status === "connecting"
              ? "bg-[hsl(45,100%,50%)] animate-pulse"
              : status === "error"
                ? "bg-[hsl(0,70%,50%)]"
                : "bg-[hsl(0,0%,40%)]"
        }`}
      />
      <span className="text-xs text-[hsl(0,0%,55%)] hidden sm:inline font-mono">
        {status === "connected" ? "LIVE" : status === "connecting" ? "SYNC" : status === "error" ? "ERR" : "OFF"}
      </span>
      {error && (
        <span className="text-xs text-[hsl(0,70%,50%)] hidden md:inline truncate max-w-32" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}

// Utilities
const generateCoinId = (symbol: string) => `${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const calculateSessionROC = (currentPrice: number, sessionStartPrice: number): number => {
  if (!sessionStartPrice || sessionStartPrice === 0) return 0
  return ((currentPrice - sessionStartPrice) / sessionStartPrice) * 100
}

const formatPrice = (price: number): string => {
  if (!price || !Number.isFinite(price)) return "—"
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => {
  if (!Number.isFinite(pct)) return "—"
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
}

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
    <div className="flex items-center gap-0.5 bg-[hsl(0,0%,8%)] rounded p-0.5 border border-[hsl(0,0%,20%)]">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-2 py-1 rounded text-xs transition-all font-mono ${
            timeframe === tf
              ? "bg-[hsl(160,100%,40%)] text-black"
              : "text-[hsl(0,0%,55%)] hover:text-[hsl(120,10%,85%)] hover:bg-[hsl(0,0%,12%)]"
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

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
  onSelectCoin: (product: CoinbaseProduct) => void
  onAddFirstMatch: () => void
}) {
  const [open, setOpen] = useState(false)
  const { products, loading } = useCoinbaseProducts()
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          !existingSymbols.includes(p.product_id) &&
          (p.product_id.toLowerCase().includes(q) ||
            p.base_currency.toLowerCase().includes(q) ||
            p.base_name.toLowerCase().includes(q)),
      )
      .slice(0, 10)
  }, [value, existingSymbols, products])

  useEffect(() => {
    setOpen(Boolean(value) && filtered.length > 0)
  }, [value, filtered.length])

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(0,0%,40%)] pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={loading ? "Loading..." : "Search (BTC, ETH...)"}
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
          onFocus={() => value && filtered.length > 0 && setOpen(true)}
          className="w-full pl-8 pr-3 py-2 bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,20%)] text-[hsl(120,10%,85%)] rounded h-9 text-sm font-mono placeholder:text-[hsl(0,0%,40%)] focus:outline-none focus:ring-1 focus:ring-[hsl(160,100%,40%)] focus:border-[hsl(160,100%,40%)]"
          disabled={loading}
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="bg-[hsl(0,0%,6%)] rounded border border-[hsl(0,0%,20%)] shadow-xl overflow-hidden max-h-64 overflow-y-auto">
            {filtered.map((product) => (
              <button
                key={product.product_id}
                onClick={() => {
                  onSelectCoin(product)
                  onValueChange("")
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 transition-colors hover:bg-[hsl(0,0%,12%)] focus:outline-none focus:bg-[hsl(0,0%,12%)] flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded bg-[hsl(160,100%,40%)] text-black text-xs font-bold font-mono flex items-center justify-center flex-shrink-0">
                  {product.base_currency.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-[hsl(120,10%,85%)]">{product.product_id}</div>
                  <div className="text-xs text-[hsl(0,0%,55%)] truncate">{product.base_name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MomentumTracker() {
  const { toast } = useToast()
  const router = useRouter()
  const { products } = useCoinbaseProducts()

  const [watchlistData, setWatchlistData] = useState<WatchlistData>({ sessionStartTime: null, coins: [] })
  const [isTracking, setIsTracking] = useState(false)
  const [momentumTimeframe, setMomentumTimeframe] = useState<MomentumTimeframe>("1m")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")
  const [sortBy, setSortBy] = useState<SortField>("momentum")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [query, setQuery] = useState("")

  const isUpdatingRef = useRef(false)
  const lastUpdateRef = useRef<number>(0)

  const symbols = useMemo(() => watchlistData.coins.map((c) => c.coinbaseId), [watchlistData.coins])
  const { book, status, error } = useCoinbase(symbols)

  const momentumTimeframeMs = useMemo(() => getTimeframeMs(momentumTimeframe), [momentumTimeframe])

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

  const sortedCoins = useMemo(() => {
    const filtered = watchlistData.coins.filter((c) => {
      const q = query.trim().toLowerCase()
      if (!q) return true
      return c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    })

    return [...filtered].sort((a, b) => {
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
  }, [watchlistData.coins, query, sortBy])

  // Update coins from WebSocket data
  const updateCoins = useCallback(
    (priceBook: typeof book) => {
      const now = Date.now()
      if (isUpdatingRef.current || now - lastUpdateRef.current < 100) return

      isUpdatingRef.current = true
      lastUpdateRef.current = now

      setWatchlistData((prev) => {
        let changed = false
        const coins = prev.coins.map((coin) => {
          const series = priceBook[coin.coinbaseId]
          if (!series || series.length === 0) return coin

          const latest = series[series.length - 1]
          const nextPrice = latest.price

          if (!nextPrice || nextPrice === coin.currentPrice) return coin

          changed = true
          const history = [...coin.priceHistory.slice(-OPTIMAL_BUFFER_SIZE + 1), { price: nextPrice, timestamp: now }]
          const sessionROC = calculateSessionROC(nextPrice, coin.sessionStartPrice)
          const momentum = calculateMomentum(history, momentumTimeframeMs)

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
        return changed ? { ...prev, coins } : prev
      })
    },
    [momentumTimeframeMs],
  )

  useEffect(() => {
    if (Object.keys(book).length > 0) {
      updateCoins(book)
    }
  }, [book, updateCoins])

  const addCoin = useCallback(
    (product: CoinbaseProduct) => {
      if (watchlistData.coins.some((c) => c.coinbaseId === product.product_id)) {
        toast({ title: "Already added", description: `${product.product_id} is already in your watchlist.` })
        return
      }

      const series = book[product.product_id]
      const currentPrice = series && series.length > 0 ? series[series.length - 1].price : 0
      const now = Date.now()

      const newCoin: CoinData = {
        id: generateCoinId(product.product_id),
        symbol: product.product_id,
        name: product.base_name,
        coinbaseId: product.product_id,
        currentPrice,
        sessionStartPrice: currentPrice,
        sessionStartTime: now,
        sessionROC: 0,
        momentum: 0,
        lastUpdated: now,
        priceHistory: currentPrice ? [{ price: currentPrice, timestamp: now }] : [],
      }

      setWatchlistData((prev) => ({
        ...prev,
        coins: [...prev.coins, newCoin],
      }))

      setQuery("")
      toast({ title: "Added", description: `${product.product_id} added to watchlist.` })
    },
    [book, watchlistData.coins, toast],
  )

  const addFirstMatch = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) return

    const match = products.find(
      (p) =>
        !watchlistData.coins.some((c) => c.coinbaseId === p.product_id) &&
        (p.product_id.toLowerCase().includes(q) ||
          p.base_currency.toLowerCase().includes(q) ||
          p.base_name.toLowerCase().includes(q)),
    )

    if (match) {
      addCoin(match)
    } else {
      toast({ title: "Not found", description: "No matching pair found." })
    }
  }, [query, products, watchlistData.coins, addCoin, toast])

  const removeCoin = useCallback(
    (id: string) => {
      const removed = watchlistData.coins.find((c) => c.id === id)
      setWatchlistData((prev) => ({ ...prev, coins: prev.coins.filter((c) => c.id !== id) }))
      if (removed) toast({ title: "Removed", description: `${removed.symbol} removed.` })
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
        sessionStartTime: now,
        sessionROC: 0,
        momentum: 0,
        priceHistory: c.currentPrice ? [{ price: c.currentPrice, timestamp: now }] : [],
      })),
    }))
    setIsTracking(true)
    setElapsedTime(0)
    toast({ title: "Race started" })
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
    toast({ title: "Reset complete" })
  }, [toast])

  const handleCoinClick = useCallback(
    (coin: CoinData) => {
      router.push(`/coin/${coin.symbol.split("-")[0].toLowerCase()}`)
    },
    [router],
  )

  const bestPerformer = sortedCoins[0]
  const fastestMover = useMemo(
    () => [...sortedCoins].sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))[0],
    [sortedCoins],
  )

  return (
    <div className="flex flex-col h-screen bg-black text-[hsl(120,10%,85%)] overflow-hidden font-mono">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,4%)]">
        <div className="px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Brand />
              <ConnectionIndicator status={status} error={error} />
              <Badge
                className={`text-xs font-mono ${
                  isTracking
                    ? "bg-[hsl(120,60%,45%)]/20 text-[hsl(120,60%,45%)] border-[hsl(120,60%,45%)]/30"
                    : "bg-[hsl(0,0%,15%)] text-[hsl(0,0%,55%)] border-[hsl(0,0%,25%)]"
                }`}
              >
                {isTracking ? "LIVE" : "READY"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {!isTracking ? (
                <Button
                  onClick={startRace}
                  disabled={watchlistData.coins.length === 0}
                  className="bg-[hsl(120,60%,45%)] hover:bg-[hsl(120,60%,40%)] text-black px-3 py-1.5 h-8 text-xs font-mono font-bold rounded disabled:opacity-50"
                >
                  <Flag className="mr-1.5 h-3 w-3" />
                  <span className="hidden sm:inline">START</span>
                </Button>
              ) : (
                <Button
                  onClick={stopRace}
                  className="bg-[hsl(0,70%,50%)] hover:bg-[hsl(0,70%,45%)] text-white px-3 py-1.5 h-8 text-xs font-mono font-bold rounded"
                >
                  <Pause className="mr-1.5 h-3 w-3" />
                  <span className="hidden sm:inline">STOP</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={resetTracking}
                disabled={!isTracking}
                className="hidden sm:flex px-3 py-1.5 h-8 bg-[hsl(0,0%,8%)] text-[hsl(0,0%,55%)] hover:bg-[hsl(0,0%,12%)] hover:text-[hsl(120,10%,85%)] border-[hsl(0,0%,20%)] text-xs font-mono rounded disabled:opacity-50"
              >
                <RotateCcw className="mr-1.5 h-3 w-3" />
                RESET
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="flex-shrink-0 border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,4%)] px-3 sm:px-4 py-2">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <div className="text-center">
            <div className="text-xs text-[hsl(0,0%,55%)] mb-0.5">PAIRS</div>
            <div className="text-lg sm:text-xl font-bold text-[hsl(180,100%,45%)]">{watchlistData.coins.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[hsl(0,0%,55%)] mb-0.5">TIME</div>
            <div className="text-lg sm:text-xl font-bold tabular-nums">
              {isTracking ? formatElapsedTime(elapsedTime) : "0:00"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[hsl(0,0%,55%)] mb-0.5">LEADER</div>
            <div className="text-lg sm:text-xl font-bold text-[hsl(120,60%,45%)] truncate">
              {bestPerformer?.symbol.split("-")[0] || "—"}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-[hsl(0,0%,55%)] mb-0.5">FASTEST</div>
            <div className="text-lg sm:text-xl font-bold text-[hsl(45,100%,50%)] truncate">
              {fastestMover?.symbol.split("-")[0] || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-3 sm:p-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <MomentumTimeframeSelector timeframe={momentumTimeframe} onTimeframeChange={setMomentumTimeframe} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)] text-[hsl(120,10%,85%)] hover:bg-[hsl(0,0%,12%)] h-8 text-xs font-mono"
                  >
                    <span className="hidden sm:inline">Sort: </span>
                    {sortBy === "momentum" ? "MTM" : sortBy === "sessionROC" ? "ROC" : "PRC"}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[hsl(0,0%,6%)] border-[hsl(0,0%,20%)] font-mono">
                  <DropdownMenuItem
                    onClick={() => setSortBy("momentum")}
                    className="text-[hsl(120,10%,85%)] hover:bg-[hsl(0,0%,12%)] text-xs"
                  >
                    Momentum
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("sessionROC")}
                    className="text-[hsl(120,10%,85%)] hover:bg-[hsl(0,0%,12%)] text-xs"
                  >
                    Session ROC
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSortBy("currentPrice")}
                    className="text-[hsl(120,10%,85%)] hover:bg-[hsl(0,0%,12%)] text-xs"
                  >
                    Price
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-48">
                <AddCoinTypeahead
                  value={query}
                  onValueChange={setQuery}
                  existingSymbols={watchlistData.coins.map((c) => c.coinbaseId)}
                  onSelectCoin={addCoin}
                  onAddFirstMatch={addFirstMatch}
                />
              </div>
              <Button
                onClick={addFirstMatch}
                disabled={!query.trim()}
                className="flex-shrink-0 bg-[hsl(160,100%,40%)] hover:bg-[hsl(160,100%,35%)] text-black px-3 py-1.5 h-9 text-xs font-mono font-bold rounded disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[hsl(0,0%,4%)] rounded border border-[hsl(0,0%,20%)] overflow-hidden">
            {sortedCoins.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[hsl(0,0%,8%)]">
                    <TableRow className="border-[hsl(0,0%,20%)] hover:bg-transparent">
                      <TableHead className="text-[hsl(0,0%,55%)] font-bold text-xs w-12 sm:w-16">#</TableHead>
                      <TableHead className="text-[hsl(0,0%,55%)] font-bold text-xs">ASSET</TableHead>
                      <TableHead className="text-right text-[hsl(0,0%,55%)] font-bold text-xs hidden sm:table-cell">
                        PRICE
                      </TableHead>
                      <TableHead className="text-right text-[hsl(0,0%,55%)] font-bold text-xs">ROC%</TableHead>
                      <TableHead className="text-right text-[hsl(0,0%,55%)] font-bold text-xs">MTM</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCoins.map((coin, index) => (
                      <TableRow
                        key={coin.id}
                        className={`border-[hsl(0,0%,15%)] cursor-pointer transition-colors hover:bg-[hsl(0,0%,8%)] ${
                          index === 0 ? "bg-[hsl(120,60%,45%)]/5" : ""
                        }`}
                        onClick={() => handleCoinClick(coin)}
                      >
                        <TableCell className="py-2 px-2 sm:px-3 w-12 sm:w-16">
                          <span
                            className={`text-sm font-bold ${index === 0 ? "text-[hsl(120,60%,45%)]" : "text-[hsl(0,0%,55%)]"}`}
                          >
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 px-2 sm:px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center text-black text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                            >
                              {coin.symbol.split("-")[0].charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-[hsl(120,10%,85%)] truncate">
                                {coin.symbol.split("-")[0]}
                              </div>
                              <div className="text-xs text-[hsl(0,0%,55%)] truncate hidden sm:block">{coin.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums py-2 px-2 sm:px-3 hidden sm:table-cell">
                          ${formatPrice(coin.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 sm:px-3">
                          <span
                            className={`font-bold text-sm tabular-nums ${
                              coin.sessionROC > 0
                                ? "text-[hsl(120,60%,45%)]"
                                : coin.sessionROC < 0
                                  ? "text-[hsl(0,70%,50%)]"
                                  : "text-[hsl(0,0%,55%)]"
                            }`}
                          >
                            {watchlistData.sessionStartTime ? formatPercentage(coin.sessionROC) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-2 px-2 sm:px-3">
                          <div className="flex items-center justify-end gap-1">
                            {Math.abs(coin.momentum) > 0.1 &&
                              (coin.momentum > 0 ? (
                                <TrendingUp className="h-3 w-3 text-[hsl(120,60%,45%)]" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-[hsl(0,70%,50%)]" />
                              ))}
                            <span
                              className={`font-bold text-sm tabular-nums ${
                                Math.abs(coin.momentum) > 0.5
                                  ? coin.momentum > 0
                                    ? "text-[hsl(120,60%,45%)]"
                                    : "text-[hsl(0,70%,50%)]"
                                  : "text-[hsl(0,0%,55%)]"
                              }`}
                            >
                              {Math.abs(coin.momentum).toFixed(2)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-2 w-10">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCoin(coin.id)
                            }}
                            className="h-7 w-7 p-0 text-[hsl(0,0%,40%)] hover:text-[hsl(0,70%,50%)] hover:bg-[hsl(0,70%,50%)]/10"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-16 text-center">
                <div className="text-[hsl(0,0%,40%)] mb-4">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                </div>
                <h3 className="text-lg font-bold text-[hsl(120,10%,85%)] mb-2">No pairs added</h3>
                <p className="text-sm text-[hsl(0,0%,55%)]">Search and add cryptocurrency pairs to start tracking.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// Function to render the chart (if it was part of the updates, it would be here)
// function RaceChart({ ... }) { ... }
