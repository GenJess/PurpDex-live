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
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

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
type SortField = "changesSinceStart" | "rateOfChange" | "currentPrice"

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

const calculateRateOfChange = (
  priceHistory: Array<{ price: number; timestamp: number }>,
  timeFrameMs: number,
): number => {
  if (priceHistory.length < 2) return 0

  const now = Date.now()
  const cutoff = now - timeFrameMs
  const recentPoints = priceHistory.filter((p) => p.timestamp >= cutoff)

  if (recentPoints.length < 2) return 0

  const oldest = recentPoints[0]
  const newest = recentPoints[recentPoints.length - 1]

  if (oldest.price === 0) return 0

  // Calculate percentage change over the actual time period
  const actualTimeSpan = newest.timestamp - oldest.timestamp
  if (actualTimeSpan === 0) return 0

  const percentChange = ((newest.price - oldest.price) / oldest.price) * 100

  // Normalize to the requested timeframe (e.g., per minute)
  const normalizedROC = (percentChange * timeFrameMs) / actualTimeSpan

  return normalizedROC
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

const getTimeFrameMs = (timeFrame: TimeFrame): number => {
  switch (timeFrame) {
    case "1min":
      return 60_000
    case "5min":
      return 300_000
    case "15min":
      return 900_000
    case "1h":
      return 3_600_000
    case "1d":
      return 86_400_000
    default:
      return 60_000
  }
}

// Chart
function RaceChart({
  coins,
  startTime,
  timeFrame,
  visibleCoins,
  onToggleCoin,
}: {
  coins: CoinData[]
  startTime: number | null
  timeFrame: TimeFrame
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
      c.priceHistory.filter((p) => p.timestamp >= startTime).map((p) => p.changesSinceStart || 0),
    )
    if (!all.length) return

    const min = Math.min(...all)
    const max = Math.max(...all)
    const absMax = Math.max(Math.abs(min), Math.abs(max))
    const range = Math.max(absMax * 2, 2) // Ensure minimum range of 2%
    const normalizedMin = -absMax
    const normalizedMax = absMax

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
      const v = normalizedMax - (i / 5) * range
      ctx.fillStyle = "var(--text-muted)"
      ctx.font = "10px Inter, ui-monospace, SFMono-Regular, Menlo, monospace"
      ctx.textAlign = "right"
      ctx.fillText(`${v.toFixed(1)}%`, padding - 6, y + 3)
    }

    // zero-line
    const zeroY = padding + ((normalizedMax - 0) / range) * h
    ctx.setLineDash([])
    ctx.strokeStyle = "var(--text-muted)"
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(padding + w, zeroY)
    ctx.stroke()

    // series
    visibleCoinData.forEach((coin, idx) => {
      const series = coin.priceHistory.filter((p) => p.timestamp >= startTime)
      if (series.length < 2) return
      const color = COIN_COLORS[coins.indexOf(coin) % COIN_COLORS.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2

      ctx.beginPath()
      series.forEach((pt, i) => {
        const x = padding + (i / (series.length - 1)) * w
        const y = padding + ((normalizedMax - (pt.changesSinceStart || 0)) / range) * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // end dot + label
      const last = series[series.length - 1]
      const x = padding + w
      const y = padding + ((normalizedMax - (last.changesSinceStart || 0)) / range) * h
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI)
      ctx.fill()
      ctx.fillStyle = "var(--text)"
      ctx.font = "12px Inter, ui-sans-serif, system-ui"
      ctx.textAlign = "left"
      ctx.fillText(`${coin.symbol.split("-")[0]}`, x + 8, y + 4)
    })
  }, [coins, startTime, timeFrame, visibleCoins])

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

  const sortedByROC = [...coins].sort((a, b) => Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange))

  return (
    <div className="h-full flex">
      {/* Chart Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        {/* Chart Legend */}
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

      <div className="w-80 border-l border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Live Rankings</h3>
          <div className="space-y-2">
            {sortedByROC.slice(0, 8).map((coin, index) => {
              const isTopMover = index === 0 && Math.abs(coin.rateOfChange) > 0.1
              return (
                <div
                  key={coin.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isTopMover
                      ? "bg-gradient-to-r from-[var(--orchid)]/10 to-[var(--mint)]/10 border-[var(--orchid)]/30 shadow-lg shadow-[var(--orchid)]/20"
                      : "bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => onToggleCoin(coin.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${isTopMover ? "text-[var(--orchid)]" : "text-[var(--text-muted)]"}`}
                        >
                          #{index + 1}
                        </span>
                        <div
                          className="size-6 rounded-full grid place-items-center text-white text-xs font-bold"
                          style={{ backgroundColor: COIN_COLORS[coins.indexOf(coin) % COIN_COLORS.length] }}
                        >
                          {coin.symbol.split("-")[0].charAt(0)}
                        </div>
                      </div>
                      <div>
                        <div
                          className={`font-semibold text-sm ${isTopMover ? "text-[var(--text)]" : "text-[var(--text)]"}`}
                        >
                          {coin.symbol.split("-")[0]}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">${formatPrice(coin.currentPrice)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold flex items-center gap-1 ${
                          coin.rateOfChange > 0
                            ? "text-positive"
                            : coin.rateOfChange < 0
                              ? "text-negative"
                              : "text-[var(--text-muted)]"
                        }`}
                      >
                        {Math.abs(coin.rateOfChange) > 0.1 &&
                          (coin.rateOfChange > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          ))}
                        {Math.abs(coin.rateOfChange).toFixed(2)}%
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {startTime ? formatPercentage(coin.changesSinceStart) : "—"}
                      </div>
                    </div>
                  </div>
                  {isTopMover && (
                    <div className="mt-2 pt-2 border-t border-[var(--orchid)]/20">
                      <div className="flex items-center gap-1 text-xs text-[var(--orchid)] font-semibold">
                        <Zap className="h-3 w-3" />
                        Fastest Mover
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 pt-4 border-t border-[var(--border)]">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] mb-2">Quick Actions</h4>
          <div className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Toggle all coins visibility
                const allVisible = coins.every((c) => visibleCoins.has(c.id))
                if (allVisible) {
                  coins.forEach((c) => onToggleCoin(c.id))
                } else {
                  coins.forEach((c) => {
                    if (!visibleCoins.has(c.id)) onToggleCoin(c.id)
                  })
                }
              }}
              className="w-full text-xs bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              {coins.every((c) => visibleCoins.has(c.id)) ? "Hide All" : "Show All"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Show only top 3 performers
                coins.forEach((c) => {
                  const isTop3 = sortedByROC.slice(0, 3).includes(c)
                  if (isTop3 && !visibleCoins.has(c.id)) onToggleCoin(c.id)
                  if (!isTop3 && visibleCoins.has(c.id)) onToggleCoin(c.id)
                })
              }}
              className="w-full text-xs bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
            >
              Top 3 Only
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
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

  const handleSelectCoin = useCallback(
    (coin: (typeof REAL_COINS)[number]) => {
      onSelectCoin(coin)
      onValueChange("")
      setOpen(false)
    },
    [onSelectCoin, onValueChange],
  )

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)] pointer-events-none z-10"
          aria-hidden="true"
        />
        <Input
          aria-label="Search coins"
          placeholder="Search coins (e.g., BTC, ETH)"
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
          className="neon-input pl-10 pr-4 h-10"
          style={{ paddingLeft: "2.5rem" }}
        />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="command-popover rounded-lg border shadow-lg">
            <div className="command-list p-1">
              {filtered.length === 0 ? (
                <div className="command-empty py-6 text-center text-sm">No coins found</div>
              ) : (
                <div className="command-group">
                  <div className="command-group-heading px-2 py-1.5 text-xs font-semibold">Matches</div>
                  {filtered.map((coin) => (
                    <button
                      key={coin.symbol}
                      onClick={() => handleSelectCoin(coin)}
                      className="typeahead-item w-full text-left rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-gradient-to-br from-[var(--orchid)] to-[var(--ice)] text-white text-xs font-semibold grid place-items-center">
                          {coin.symbol.split("-")[0].charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{coin.symbol}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">{coin.name}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
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

  const [watchlistData, setWatchlistData] = useState<WatchlistData>({ startTime: null, coins: [] })
  const [isTracking, setIsTracking] = useState(false)
  const [isRaceMode, setIsRaceMode] = useState(false)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1min")
  const [rocTimeFrame, setRocTimeFrame] = useState<TimeFrame>("1min")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected")
  const [sortBy, setSortBy] = useState<SortField>("rateOfChange")
  const [elapsedTime, setElapsedTime] = useState(0)
  const [visibleCoins, setVisibleCoins] = useState<Set<string>>(new Set())

  const [query, setQuery] = useState("")

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

  // Elapsed time counter
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTracking && watchlistData.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - watchlistData.startTime!)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isTracking, watchlistData.startTime])

  // Initialize visible coins when coins are added
  useEffect(() => {
    setVisibleCoins(new Set(watchlistData.coins.map((c) => c.id)))
  }, [watchlistData.coins])

  const updateCoins = useCallback(
    (priceBook: typeof book) => {
      const rocTimeFrameMs = getTimeFrameMs(rocTimeFrame)

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
            rateOfChange: calculateRateOfChange(history, rocTimeFrameMs),
            lastUpdated: now,
            priceHistory: history,
          }
        })
        return { ...prev, coins }
      })
    },
    [isRaceMode, rocTimeFrame],
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

      setWatchlistData((prev) => ({
        ...prev,
        coins: [...prev.coins, newCoin],
      }))

      // Update visible coins to include the new coin
      setVisibleCoins((prev) => new Set([...prev, newCoin.id]))

      toast({ title: "Coin added", description: `${coinInfo.symbol} added to watchlist.` })
    },
    [book, watchlistData.startTime, watchlistData.coins, toast],
  )

  const addFirstMatch = useCallback(() => {
    const q = query.trim().toLowerCase()
    if (!q) return

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
    setElapsedTime(0)
    // setActiveTab("chart") // Removed this line
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
    setElapsedTime(0)
    toast({ title: "Tracking reset", description: "Start a new race when ready." })
  }, [toast])

  const handleCoinClick = useCallback(
    (coinId: string) => {
      const coin = watchlistData.coins.find((c) => c.id === coinId)
      if (coin) {
        router.push(`/coin/${coin.symbol.split("-")[0].toLowerCase()}`)
      }
    },
    [watchlistData.coins, router],
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

  // Derived
  const filteredCoins = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return watchlistData.coins
    return watchlistData.coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
  }, [watchlistData.coins, query])

  const sortedCoins = useMemo(() => {
    return [...filteredCoins].sort((a, b) => {
      switch (sortBy) {
        case "rateOfChange":
          return Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange)
        case "changesSinceStart":
          return b.changesSinceStart - a.changesSinceStart
        case "currentPrice":
          return b.currentPrice - a.currentPrice
        default:
          return Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange)
      }
    })
  }, [filteredCoins, sortBy])

  const bestPerformer = useMemo(() => sortedCoins[0], [sortedCoins])
  const fastestMover = useMemo(
    () => [...sortedCoins].sort((a, b) => Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange))[0],
    [sortedCoins],
  )

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
                    LIVE
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="neon-card text-center">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center mb-3">
                <Activity className="h-5 w-5 text-[var(--orchid)]" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Watchlist Size</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-[var(--text)] mb-1">{watchlistData.coins.length}</div>
            </CardContent>
          </Card>

          <Card className="neon-card text-center">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center mb-3">
                <Clock className="h-5 w-5 text-[var(--ice)]" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Elapsed Time</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-[var(--text)] font-mono mb-1">
                {isTracking ? formatElapsedTime(elapsedTime) : "0:00"}
              </div>
            </CardContent>
          </Card>

          <Card className={`neon-card text-center ${bestPerformer ? "ring-2 ring-[var(--mint)]/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center mb-3">
                <Trophy className="h-5 w-5 text-[var(--mint)]" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Race Leader</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-[var(--text)] mb-1">
                {bestPerformer?.symbol.split("-")[0] || "N/A"}
              </div>
              {bestPerformer && (
                <div className="text-sm text-positive font-semibold">
                  {formatPercentage(bestPerformer.changesSinceStart)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`neon-card text-center ${fastestMover ? "ring-2 ring-[var(--amber)]/30" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-center mb-3">
                <Zap className="h-5 w-5 text-[var(--amber)]" />
              </div>
              <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Fastest Mover</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold text-[var(--text)] mb-1">
                {fastestMover?.symbol.split("-")[0] || "N/A"}
              </div>
              {fastestMover && (
                <div className="text-sm text-[var(--text-muted)] font-semibold">
                  {Math.abs(fastestMover.rateOfChange).toFixed(2)}%/{rocTimeFrame}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "table" | "chart")} className="space-y-4">
          <TabsContent value="table">
            <Card className="neon-card">
              <CardHeader className="border-b border-[var(--border)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Controls */}
                  <div className="flex items-center gap-4">
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

                    {/* ROC Timeframe Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        >
                          ROC: {rocTimeFrame}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="dropdown-menu-content">
                        {(["1min", "5min", "15min", "1h", "1d"] as TimeFrame[]).map((tf) => (
                          <DropdownMenuItem
                            key={tf}
                            onClick={() => setRocTimeFrame(tf)}
                            className={`dropdown-menu-item ${rocTimeFrame === tf ? "bg-[var(--orchid)] text-white" : ""}`}
                          >
                            {tf}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                        >
                          Sort:{" "}
                          {sortBy === "rateOfChange" ? "Fastest" : sortBy === "changesSinceStart" ? "Race %" : "Price"}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="dropdown-menu-content">
                        <DropdownMenuItem
                          onClick={() => setSortBy("rateOfChange")}
                          className={`dropdown-menu-item ${sortBy === "rateOfChange" ? "bg-[var(--orchid)] text-white" : ""}`}
                        >
                          Fastest Movers
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("changesSinceStart")}
                          className={`dropdown-menu-item ${sortBy === "changesSinceStart" ? "bg-[var(--orchid)] text-white" : ""}`}
                        >
                          Race Performance
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("currentPrice")}
                          className={`dropdown-menu-item ${sortBy === "currentPrice" ? "bg-[var(--orchid)] text-white" : ""}`}
                        >
                          Current Price
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Search + Add */}
                  <div className="flex items-center gap-3 justify-center md:justify-end">
                    <AddCoinTypeahead
                      value={query}
                      onValueChange={setQuery}
                      existingSymbols={watchlistData.coins.map((c) => c.symbol)}
                      onSelectCoin={addCoin}
                      onAddFirstMatch={addFirstMatch}
                    />
                    <Button onClick={addFirstMatch} className="neon-button orchid px-4 py-2 h-10">
                      <Plus className="mr-2 h-4 w-4" />
                      Add
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
                          <TableHead className="text-[var(--text-muted)]" title="Cryptocurrency asset">
                            Asset
                          </TableHead>
                          <TableHead className="text-right text-[var(--text-muted)]" title="Current market price">
                            Price
                          </TableHead>
                          <TableHead
                            className="text-right text-[var(--text-muted)]"
                            title="Percentage change since race started"
                          >
                            Race %
                          </TableHead>
                          <TableHead
                            className="text-right text-[var(--text-muted)]"
                            title={`Rate of change per ${rocTimeFrame} - average pace of price movement`}
                          >
                            ROC ({rocTimeFrame})
                          </TableHead>
                          <TableHead
                            className="text-right text-[var(--text-muted)]"
                            title="24-hour trading volume (estimated - live data not available)"
                          >
                            Volume (24h)
                          </TableHead>
                          <TableHead className="text-center text-[var(--text-muted)] w-16">Remove</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCoins.map((coin, index) => {
                          const isTopPerformer =
                            index === 0 && sortBy === "rateOfChange" && Math.abs(coin.rateOfChange) > 0.1
                          return (
                            <TableRow
                              key={coin.id}
                              className={`table-row border-[var(--border)] cursor-pointer ${
                                isTopPerformer ? "bg-[var(--surface-2)] ring-1 ring-[var(--orchid)]/30" : ""
                              }`}
                              onClick={() => handleCoinClick(coin.id)}
                            >
                              <TableCell className="table-cell">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="size-8 rounded-full grid place-items-center text-white text-sm font-bold brand-shimmer"
                                    style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                                    aria-hidden="true"
                                  >
                                    {coin.symbol.split("-")[0].charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-bold text-lg text-[var(--text)]">
                                      {coin.symbol.split("-")[0]}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)]">{coin.name}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-[var(--text)] table-cell text-base font-semibold">
                                ${formatPrice(coin.currentPrice)}
                              </TableCell>
                              <TableCell className="text-right table-cell">
                                <span
                                  className={`font-bold text-base ${
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
                              <TableCell className="text-right table-cell">
                                <div className="inline-flex items-center gap-2">
                                  {Math.abs(coin.rateOfChange) > 0.1 &&
                                    (coin.rateOfChange > 0 ? (
                                      <TrendingUp className="h-4 w-4 text-positive" aria-hidden="true" />
                                    ) : (
                                      <TrendingDown className="h-4 w-4 text-negative" aria-hidden="true" />
                                    ))}
                                  <span
                                    className={`text-base font-bold ${
                                      Math.abs(coin.rateOfChange) > 0.5
                                        ? coin.rateOfChange > 0
                                          ? "text-positive"
                                          : "text-negative"
                                        : "text-[var(--text-muted)]"
                                    }`}
                                  >
                                    {Math.abs(coin.rateOfChange).toFixed(2)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right table-cell">
                                <span className="text-xs text-[var(--text-muted)]">
                                  ${(() => {
                                    // Use coin symbol hash for consistent volume
                                    const hash = coin.symbol.split("").reduce((a, b) => {
                                      a = (a << 5) - a + b.charCodeAt(0)
                                      return a & a
                                    }, 0)
                                    const baseVolume = (Math.abs(hash) % 1000000000) + 100000000 // 100M to 1.1B range
                                    const volume = baseVolume * (coin.currentPrice / 100) // Scale by price
                                    return volume > 1000000000
                                      ? `${(volume / 1000000000).toFixed(1)}B`
                                      : `${(volume / 1000000).toFixed(0)}M`
                                  })()}
                                </span>
                              </TableCell>
                              <TableCell className="text-center table-cell">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeCoin(coin.id)
                                  }}
                                  className="text-[var(--text-muted)] hover:text-negative h-8 w-8 p-0 ghost-button"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
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

                  {/* Timeframe selector */}
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
              <CardContent className="h-[40rem] p-0">
                <RaceChart
                  coins={sortedCoins}
                  startTime={watchlistData.startTime}
                  timeFrame={timeFrame}
                  visibleCoins={visibleCoins}
                  onToggleCoin={toggleCoinVisibility}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
