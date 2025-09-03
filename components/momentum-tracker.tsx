"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
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
  MoreHorizontal,
  LineChart,
  LayoutList,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Types
interface CoinData {
  id: string
  symbol: string
  name: string
  coinbaseId: string
  currentPrice: number
  startPrice: number
  changesSinceStart: number
  normalizedPrice?: number
  dailyChange: number
  rateOfChange: number
  lastUpdated: number
  priceHistory: Array<{ price: number; timestamp: number; changesSinceStart?: number }>
  racePosition?: number
  previousPosition?: number
}

interface WatchlistData {
  startTime: number | null
  coins: CoinData[]
}

type TimeFrame = "1min" | "5min" | "15min" | "1h" | "1d"

// Real crypto data with Coinbase product IDs
const REAL_COINS = [
  { symbol: "BTC-USD", name: "Bitcoin", basePrice: 67234.56, coinbaseId: "BTC-USD" },
  { symbol: "ETH-USD", name: "Ethereum", basePrice: 3456.78, coinbaseId: "ETH-USD" },
  { symbol: "SOL-USD", name: "Solana", basePrice: 189.45, coinbaseId: "SOL-USD" },
  { symbol: "ADA-USD", name: "Cardano", basePrice: 0.4567, coinbaseId: "ADA-USD" },
  { symbol: "DOGE-USD", name: "Dogecoin", basePrice: 0.0847, coinbaseId: "DOGE-USD" },
  { symbol: "AVAX-USD", name: "Avalanche", basePrice: 34.56, coinbaseId: "AVAX-USD" },
  { symbol: "UNI-USD", name: "Uniswap", basePrice: 8.42, coinbaseId: "UNI-USD" },
  { symbol: "LINK-USD", name: "Chainlink", basePrice: 14.23, coinbaseId: "LINK-USD" },
]

const COIN_COLORS = ["#9C6BFF", "#00FF88", "#4FD1FF", "#FF4D6D", "#FFAE2B", "#f97316", "#ec4899", "#06b6d4"]

// Brand logo
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--orchid)] to-[var(--rose)] flex items-center justify-center text-white font-bold text-lg brand-shimmer">
        PD
      </div>
      <div className="leading-tight">
        <div className="text-xl font-bold bg-gradient-to-r from-[var(--text)] to-[var(--orchid)] bg-clip-text text-transparent">
          PurpDex
        </div>
        <div className="text-xs text-[var(--text-muted)]">Live ROC Momentum Tracker</div>
      </div>
    </div>
  )
}

// Utilities
const generateCoinId = (symbol: string) => `${symbol}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const calculateChangesSinceStart = (currentPrice: number, startPrice: number): number => {
  if (!startPrice) return 0
  return ((currentPrice - startPrice) / startPrice) * 100
}

const calculateRateOfChange = (priceHistory: Array<{ price: number; timestamp: number }>): number => {
  if (priceHistory.length < 2) return 0
  const now = Date.now()
  const recent = priceHistory.filter((p) => now - p.timestamp <= 60_000)
  if (recent.length < 2) return 0
  const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp
  const priceChange = recent[recent.length - 1].price - recent[0].price
  const startPrice = recent[0].price
  if (timeSpan === 0 || startPrice === 0) return 0
  return ((priceChange / startPrice) * 100 * 60_000) / timeSpan
}

const formatPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`

// Chart
function RaceChart({
  coins,
  startTime,
  timeFrame,
}: { coins: CoinData[]; startTime: number | null; timeFrame: TimeFrame }) {
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

    const all = coins.flatMap((c) =>
      c.priceHistory.filter((p) => p.timestamp >= startTime).map((p) => p.changesSinceStart || 0),
    )
    if (!all.length) return

    const min = Math.min(...all, -1)
    const max = Math.max(...all, 1)
    const range = Math.max(max - min, 2)

    // grid
    ctx.strokeStyle = "var(--border)"
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * h
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + w, y)
      ctx.stroke()
      const v = max - (i / 5) * range
      ctx.fillStyle = "var(--text-muted)"
      ctx.font = "10px Inter, ui-monospace, SFMono-Regular, Menlo, monospace"
      ctx.textAlign = "right"
      ctx.fillText(`${v.toFixed(1)}%`, padding - 6, y + 3)
    }

    // zero-line
    const zeroY = padding + ((max - 0) / range) * h
    ctx.setLineDash([])
    ctx.strokeStyle = "var(--text-muted)"
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(padding + w, zeroY)
    ctx.stroke()

    // series
    coins.forEach((coin, idx) => {
      const series = coin.priceHistory.filter((p) => p.timestamp >= startTime)
      if (series.length < 2) return
      const color = COIN_COLORS[idx % COIN_COLORS.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2

      ctx.beginPath()
      series.forEach((pt, i) => {
        const x = padding + (i / (series.length - 1)) * w
        const y = padding + ((max - (pt.changesSinceStart || 0)) / range) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // end dot + label
      const last = series[series.length - 1]
      const x = padding + w
      const y = padding + ((max - (last.changesSinceStart || 0)) / range) * h
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = "var(--text)"
      ctx.font = "12px Inter, ui-sans-serif, system-ui"
      ctx.textAlign = "left"
      ctx.fillText(`${coin.symbol.split("-")[0]}`, x + 8, y + 4)
    })
  }, [coins, startTime, timeFrame])

  if (!startTime || coins.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
        <div className="text-center">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-60" />
          <p className="text-sm">Start a race to see the momentum chart</p>
        </div>
      </div>
    )
  }
  return <canvas ref={canvasRef} className="w-full h-full" />
}

// Typeahead Add
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
  onSelectCoin: (coin: (typeof REAL_COINS)[number]) => void
  onAddFirstMatch: () => void
}) {
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return REAL_COINS.filter(
      (c) =>
        !existingSymbols.includes(c.symbol) && (c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    ).slice(0, 8)
  }, [value, existingSymbols])

  useEffect(() => {
    setOpen(Boolean(value) && filtered.length > 0)
  }, [value, filtered.length])

  return (
    <div className="relative w-[26rem] max-w-full">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <Input
          aria-label="Search coins"
          placeholder="Search coins (e.g., BTC, ETH) — press Enter to add"
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
          className="neon-input pl-9 placeholder:text-[var(--text-muted)]"
        />
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Toggle suggestions</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[26rem] p-0 neon-card">
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput
              value={value}
              onValueChange={(v) => onValueChange(v)}
              placeholder="Filter coins..."
              className="hidden"
            />
            <CommandList className="max-h-64">
              {filtered.length === 0 ? (
                <CommandEmpty>No coins found</CommandEmpty>
              ) : (
                <CommandGroup heading="Matches">
                  {filtered.map((coin) => (
                    <CommandItem
                      key={coin.symbol}
                      value={coin.symbol}
                      onSelect={() => {
                        onSelectCoin(coin)
                        onValueChange("")
                        setOpen(false)
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-gradient-to-br from-[var(--orchid)] to-[var(--ice)] text-white text-xs font-semibold grid place-items-center">
                          {coin.symbol.split("-")[0].charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--text)]">{coin.symbol}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">{coin.name}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default function MomentumTracker() {
  const { toast } = useToast()

  const [watchlistData, setWatchlistData] = useState<WatchlistData>({ startTime: null, coins: [] })
  const [isTracking, setIsTracking] = useState(false)
  const [isRaceMode, setIsRaceMode] = useState(false)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1min")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")

  const [query, setQuery] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const symbols = useMemo(() => watchlistData.coins.map((c) => c.coinbaseId), [watchlistData.coins])
  const { book } = useCoinbase(symbols)

  // Update connection status based on data flow
  useEffect(() => {
    if (Object.keys(book).length > 0) {
      setConnectionStatus("connected")
    } else if (symbols.length > 0) {
      setConnectionStatus("connecting")
    } else {
      setConnectionStatus("disconnected")
    }
  }, [book, symbols])

  const updateCoins = useCallback(
    (priceBook: typeof book) => {
      setWatchlistData((prev) => {
        const coins = prev.coins.map((coin) => {
          const series = priceBook[coin.coinbaseId]
          if (!series || series.length === 0) return coin

          const latest = series[series.length - 1]
          const nextPrice = latest.price

          if (!nextPrice || nextPrice === coin.currentPrice) return coin

          const now = Date.now()
          const change = calculateChangesSinceStart(nextPrice, coin.startPrice)
          const normalized = isRaceMode ? change : coin.normalizedPrice
          const history = [
            ...coin.priceHistory.slice(-100),
            { price: nextPrice, timestamp: now, changesSinceStart: change },
          ]

          return {
            ...coin,
            currentPrice: nextPrice,
            changesSinceStart: change,
            normalizedPrice: normalized,
            rateOfChange: calculateRateOfChange(history),
            lastUpdated: now,
            priceHistory: history,
          }
        })
        return { ...prev, coins }
      })
    },
    [isRaceMode],
  )

  useEffect(() => {
    if (Object.keys(book).length > 0) updateCoins(book)
  }, [book, updateCoins])

  const addCoin = useCallback(
    (coinInfo: (typeof REAL_COINS)[number]) => {
      if (watchlistData.coins.some((c) => c.symbol === coinInfo.symbol)) {
        toast({ title: "Already added", description: `${coinInfo.symbol} is already in your watchlist.` })
        return
      }

      const series = book[coinInfo.coinbaseId]
      const currentPrice = series && series.length > 0 ? series[series.length - 1].price : coinInfo.basePrice
      const now = Date.now()

      const newCoin: CoinData = {
        id: generateCoinId(coinInfo.symbol),
        symbol: coinInfo.symbol,
        name: coinInfo.name,
        coinbaseId: coinInfo.coinbaseId,
        currentPrice,
        startPrice: watchlistData.startTime ? currentPrice : 0,
        changesSinceStart: 0,
        normalizedPrice: 0,
        dailyChange: (Math.random() - 0.5) * 10,
        rateOfChange: 0,
        lastUpdated: now,
        priceHistory: [{ price: currentPrice, timestamp: now, changesSinceStart: 0 }],
        racePosition: 1,
        previousPosition: 1,
      }
      setWatchlistData((prev) => ({ ...prev, coins: [...prev.coins, newCoin] }))
      toast({ title: "Coin added", description: `${coinInfo.symbol} added to watchlist.` })
    },
    [book, watchlistData.startTime, watchlistData.coins, toast],
  )

  const addFirstMatch = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setIsAddModalOpen(true)
      return
    }
    const match = REAL_COINS.find(
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
      if (removed) toast({ title: "Removed", description: `${removed.symbol} removed from watchlist.` })
    },
    [watchlistData.coins, toast],
  )

  const startRace = useCallback(() => {
    const now = Date.now()
    setWatchlistData((prev) => ({
      startTime: now,
      coins: prev.coins.map((c) => ({
        ...c,
        startPrice: c.currentPrice,
        changesSinceStart: 0,
        normalizedPrice: 0,
        priceHistory: [{ price: c.currentPrice, timestamp: now, changesSinceStart: 0 }],
        racePosition: 1,
        previousPosition: 1,
      })),
    }))
    setIsTracking(true)
    setIsRaceMode(true)
    setActiveTab("chart")
    toast({ title: "Race started", description: "All coins normalized to 0%." })
  }, [toast])

  const stopRace = useCallback(() => {
    setIsRaceMode(false)
    toast({ title: "Race stopped" })
  }, [toast])

  const resetTracking = useCallback(() => {
    setWatchlistData((prev) => ({
      ...prev,
      startTime: null,
      coins: prev.coins.map((c) => ({
        ...c,
        startPrice: 0,
        changesSinceStart: 0,
        normalizedPrice: 0,
        priceHistory: [],
        racePosition: 1,
        previousPosition: 1,
      })),
    }))
    setIsTracking(false)
    setIsRaceMode(false)
    toast({ title: "Tracking reset", description: "Start a new race when ready." })
  }, [toast])

  // Derived
  const filteredCoins = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return watchlistData.coins
    return watchlistData.coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  }, [watchlistData.coins, query])

  const sortedCoins = useMemo(() => {
    return [...filteredCoins].sort((a, b) => b.changesSinceStart - a.changesSinceStart)
  }, [filteredCoins])

  const bestPerformer = useMemo(() => sortedCoins[0], [sortedCoins])
  const fastestMover = useMemo(
    () => [...sortedCoins].sort((a, b) => Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange))[0],
    [sortedCoins],
  )

  const getStatusBadge = (coin: CoinData) => {
    const change = coin.changesSinceStart
    if (Math.abs(change) > 5) return { text: "HOT", class: "status-hot" }
    if (Math.abs(change) > 2) return { text: "ACTIVE", class: "status-active" }
    if (change > 0) return { text: "POSITIVE", class: "status-positive" }
    if (change < 0) return { text: "NEGATIVE", class: "status-negative" }
    return { text: "STABLE", class: "status-neutral" }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-2)]">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/60 shadow-[var(--shadow-1)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Brand />
              <div className="hidden md:flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === "connected"
                      ? "bg-[var(--mint)] live-dot"
                      : connectionStatus === "connecting"
                        ? "bg-[var(--amber)] animate-pulse"
                        : "bg-[var(--text-muted)]"
                  }`}
                />
                <Badge className={isRaceMode ? "status-hot" : isTracking ? "status-active" : "status-neutral"}>
                  {isRaceMode ? "Race Active" : isTracking ? "Tracking" : "Ready"}
                </Badge>
                {connectionStatus === "connected" && (
                  <div className="live-indicator">
                    <div className="live-dot"></div>
                    LIVE DATA
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-1">
                <Button
                  size="sm"
                  variant={activeTab === "table" ? "default" : "ghost"}
                  onClick={() => setActiveTab("table")}
                  className={
                    activeTab === "table" ? "neon-button orchid" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }
                  aria-pressed={activeTab === "table"}
                >
                  <LayoutList className="mr-2 h-4 w-4" />
                  Table
                </Button>
                <Button
                  size="sm"
                  variant={activeTab === "chart" ? "default" : "ghost"}
                  onClick={() => setActiveTab("chart")}
                  className={
                    activeTab === "chart" ? "neon-button orchid" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }
                  aria-pressed={activeTab === "chart"}
                >
                  <LineChart className="mr-2 h-4 w-4" />
                  Chart
                </Button>
              </div>

              {!isRaceMode ? (
                <Button
                  onClick={startRace}
                  disabled={watchlistData.coins.length === 0}
                  className="neon-button px-4 py-2"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  Start Race
                </Button>
              ) : (
                <Button onClick={stopRace} className="neon-button rose px-4 py-2">
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Race
                </Button>
              )}

              <Button
                variant="outline"
                onClick={resetTracking}
                disabled={!isTracking}
                className="px-4 py-2 bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] border border-[var(--border)]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="neon-card accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Watchlist Size</CardTitle>
              <Activity className="h-4 w-4 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)]">{watchlistData.coins.length}</div>
            </CardContent>
          </Card>

          <Card className="neon-card accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                {isRaceMode ? "Race Started" : "Tracking Since"}
              </CardTitle>
              <Clock className="h-4 w-4 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)]">
                {watchlistData.startTime
                  ? new Date(watchlistData.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "Not Started"}
              </div>
              {watchlistData.startTime && (
                <div className="text-xs text-[var(--text-muted)]">
                  {Math.floor((Date.now() - watchlistData.startTime) / 60000)}m elapsed
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="neon-card accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                {isRaceMode ? "Race Leader" : "Best Performer"}
              </CardTitle>
              {isRaceMode ? (
                <Trophy className="h-4 w-4 text-[var(--text-muted)]" />
              ) : (
                <TrendingUp className="h-4 w-4 text-[var(--text-muted)]" />
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)]">
                {bestPerformer?.symbol.split("-")[0] || "N/A"}
              </div>
              {bestPerformer && (
                <div className="text-xs text-positive">{formatPercentage(bestPerformer.changesSinceStart)}</div>
              )}
            </CardContent>
          </Card>

          <Card className="neon-card accent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Fastest Mover</CardTitle>
              <Zap className="h-4 w-4 text-[var(--text-muted)]" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)]">{fastestMover?.symbol.split("-")[0] || "N/A"}</div>
              {fastestMover && (
                <div className="text-xs text-[var(--text-muted)]">{fastestMover.rateOfChange.toFixed(2)}%/min</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "table" | "chart")} className="space-y-4">
          <TabsContent value="table">
            <Card className="neon-card">
              <CardHeader className="border-b border-[var(--border)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  {/* View toggle */}
                  <TabsList className="bg-[var(--surface-2)] border border-[var(--border)]">
                    <TabsTrigger
                      value="table"
                      className="data-[state=active]:bg-[var(--orchid)] data-[state=active]:text-white text-[var(--text-muted)]"
                    >
                      <LayoutList className="mr-2 h-4 w-4" />
                      Table
                    </TabsTrigger>
                    <TabsTrigger
                      value="chart"
                      onClick={() => setActiveTab("chart")}
                      className="data-[state=active]:bg-[var(--orchid)] data-[state=active]:text-white text-[var(--text-muted)]"
                    >
                      <LineChart className="mr-2 h-4 w-4" />
                      Chart
                    </TabsTrigger>
                  </TabsList>

                  {/* Search + Add */}
                  <div className="flex items-center gap-2">
                    <AddCoinTypeahead
                      value={query}
                      onValueChange={setQuery}
                      existingSymbols={watchlistData.coins.map((c) => c.symbol)}
                      onSelectCoin={(coin) => addCoin(coin)}
                      onAddFirstMatch={addFirstMatch}
                    />
                    <Button onClick={addFirstMatch} className="neon-button orchid px-4 py-2">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Coin
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {sortedCoins.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-[var(--surface-2)] z-10">
                        <TableRow className="border-[var(--border)]">
                          <TableHead className="text-[var(--text-muted)]">Asset</TableHead>
                          <TableHead className="text-right text-[var(--text-muted)]">Current Price</TableHead>
                          <TableHead className="text-right text-[var(--text-muted)]">
                            {isRaceMode ? "Race %" : "% Since Start"}
                          </TableHead>
                          <TableHead className="text-right text-[var(--text-muted)]">Rate of Change</TableHead>
                          <TableHead className="text-right text-[var(--text-muted)]">Daily %</TableHead>
                          <TableHead className="text-center text-[var(--text-muted)]">Status</TableHead>
                          <TableHead className="text-center text-[var(--text-muted)]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCoins.map((coin, index) => {
                          const status = getStatusBadge(coin)
                          return (
                            <TableRow
                              key={coin.id}
                              className="border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div
                                    className="size-8 rounded-full grid place-items-center text-white text-sm font-semibold brand-shimmer"
                                    style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                                    aria-hidden="true"
                                  >
                                    {coin.symbol.split("-")[0].charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-[var(--text)]">{coin.symbol.split("-")[0]}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{coin.name}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-[var(--text)]">
                                ${formatPrice(coin.currentPrice)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`font-semibold ${
                                    coin.changesSinceStart > 0
                                      ? "text-positive"
                                      : coin.changesSinceStart < 0
                                        ? "text-negative"
                                        : "text-[var(--text-muted)]"
                                  }`}
                                >
                                  {watchlistData.startTime ? formatPercentage(coin.changesSinceStart) : "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-1">
                                  {Math.abs(coin.rateOfChange) > 0.1 &&
                                    (coin.rateOfChange > 0 ? (
                                      <TrendingUp className="h-3 w-3 text-positive" aria-hidden="true" />
                                    ) : (
                                      <TrendingDown className="h-3 w-3 text-negative" aria-hidden="true" />
                                    ))}
                                  <span
                                    className={`text-sm ${
                                      Math.abs(coin.rateOfChange) > 0.5
                                        ? coin.rateOfChange > 0
                                          ? "text-positive"
                                          : "text-negative"
                                        : "text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {coin.rateOfChange.toFixed(2)}%/min
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={coin.dailyChange > 0 ? "text-positive" : "text-negative"}>
                                  {formatPercentage(coin.dailyChange)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full border ${status.class}`}
                                >
                                  {status.text}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="neon-card">
                                    <DropdownMenuItem
                                      onClick={() => removeCoin(coin.id)}
                                      className="text-negative focus:text-negative focus:bg-[var(--surface-hover)]"
                                    >
                                      <X className="mr-2 h-4 w-4" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-16 text-center">
                    <div className="mx-auto size-16 rounded-full bg-[var(--surface-2)] grid place-items-center mb-4">
                      <Plus className="h-7 w-7 text-[var(--text-muted)]" />
                    </div>
                    <div className="text-lg font-medium text-[var(--text)]">Start Building Your Watchlist</div>
                    <div className="text-[var(--text-muted)] text-sm mt-1">Search and add coins to get started.</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chart">
            <Card className="neon-card">
              <CardHeader className="border-b border-[var(--border)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("table")}
                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      ← Back to Table
                    </Button>
                    <div>
                      <CardTitle className="text-base text-[var(--text)]">Momentum Chart</CardTitle>
                      <CardDescription className="text-[var(--text-muted)]">
                        Normalized performance since start
                      </CardDescription>
                    </div>
                  </div>

                  {/* Timeframe moved to chart header (top-right on desktop, natural flow on mobile) */}
                  <div className="flex items-center gap-1 border border-[var(--border)] rounded-lg p-1 bg-[var(--surface-2)]">
                    {(["1min", "5min", "15min", "1h", "1d"] as TimeFrame[]).map((tf) => (
                      <Button
                        key={tf}
                        size="sm"
                        variant={timeFrame === tf ? "default" : "ghost"}
                        onClick={() => setTimeFrame(tf)}
                        className={
                          timeFrame === tf ? "neon-button orchid" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                        }
                        aria-pressed={timeFrame === tf}
                      >
                        {tf}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[28rem] p-0">
                <div className="h-full">
                  <RaceChart coins={sortedCoins} startTime={watchlistData.startTime} timeFrame={timeFrame} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Fallback Add Dialog (optional selector when no query) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md neon-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">Add Coin to Watchlist</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">Pick from popular assets.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-64">
            <div className="grid grid-cols-1 gap-2">
              {REAL_COINS.filter((c) => !watchlistData.coins.some((coin) => coin.symbol === c.symbol)).map((coin) => (
                <Button
                  key={coin.symbol}
                  variant="ghost"
                  className="justify-start h-auto py-3 hover:bg-[var(--surface-hover)]"
                  onClick={() => {
                    addCoin(coin)
                    setIsAddModalOpen(false)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-gradient-to-br from-[var(--orchid)] to-[var(--ice)] text-white text-sm font-semibold grid place-items-center brand-shimmer">
                      {coin.symbol.split("-")[0].charAt(0)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-[var(--text)]">{coin.symbol}</div>
                      <div className="text-xs text-[var(--text-muted)]">{coin.name}</div>
                    </div>
                  </div>
                </Button>
              ))}
              {REAL_COINS.filter((c) => !watchlistData.coins.some((coin) => coin.symbol === c.symbol)).length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">All coins added</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Mini sparkline
function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) return <div className="w-16 h-6" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 60
      const y = 20 - ((v - min) / range) * 16
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg width="60" height="20" className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "var(--mint)" : "var(--rose)"}
        strokeWidth="1.5"
        opacity="0.9"
      />
    </svg>
  )
}
