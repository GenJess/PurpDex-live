"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCoinbase, type ConnectionStatus } from "@/hooks/use-coinbase"
import { useCoinbaseProducts, type CoinbaseProduct } from "@/hooks/use-coinbase-products"
import { TrendingUp, Search, Plus, X, RotateCcw, Flag, Pause, Activity, Wifi, WifiOff } from "lucide-react"
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

type SortField = "sessionROC" | "momentum" | "currentPrice"

const COIN_COLORS = [
  "#00d4ff", // Cyan
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Teal
  "#8b5cf6", // Violet
  "#f97316", // Orange
]

const OPTIMAL_BUFFER_SIZE = getOptimalBufferSize()

// Brand logo
function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded bg-[hsl(185,100%,50%)] flex items-center justify-center text-black font-bold text-xs sm:text-sm font-mono">
        PD
      </div>
      <div className="leading-tight hidden sm:block">
        <div className="text-sm font-semibold text-[hsl(210,20%,90%)] font-mono">PurpDex</div>
        <div className="text-xs text-[hsl(210,10%,55%)]">Live Tracker</div>
      </div>
    </div>
  )
}

function ConnectionIndicator({ status, error }: { status: ConnectionStatus; error: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {status === "connected" ? (
        <Wifi className="w-4 h-4 text-[hsl(185,100%,50%)]" />
      ) : status === "connecting" ? (
        <Wifi className="w-4 h-4 text-[hsl(40,100%,55%)] animate-pulse" />
      ) : (
        <WifiOff className="w-4 h-4 text-[hsl(210,10%,55%)]" />
      )}
      <span className="text-xs text-[hsl(210,10%,55%)] hidden sm:inline font-mono">
        {status === "connected"
          ? "LIVE"
          : status === "connecting"
            ? "CONNECTING"
            : status === "error"
              ? "ERROR"
              : "OFFLINE"}
      </span>
      {error && (
        <span className="text-xs text-[hsl(25,100%,50%)] hidden md:inline truncate max-w-32" title={error}>
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
    <div className="flex items-center gap-0.5 bg-[hsl(210,15%,8%)] rounded p-0.5 border border-[hsl(210,15%,18%)]">
      {timeframes.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeframeChange(tf)}
          className={`px-2 py-1 rounded text-xs transition-all font-mono ${
            timeframe === tf
              ? "bg-[hsl(185,100%,50%)] text-black"
              : "text-[hsl(210,10%,55%)] hover:text-[hsl(210,20%,90%)] hover:bg-[hsl(210,15%,12%)]"
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
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          !existingSymbols.includes(p.product_id) &&
          (p.base_currency.toLowerCase().includes(q) ||
            p.base_name.toLowerCase().includes(q) ||
            p.product_id.toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [products, value, existingSymbols])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault()
      onSelectCoin(filtered[0])
      onValueChange("")
      setOpen(false)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(210,10%,45%)] pointer-events-none z-10" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value)
            setOpen(e.target.value.length > 0)
          }}
          onFocus={() => value.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search coins (BTC, ETH...)"
          className="pl-10 pr-3 h-9 bg-[hsl(210,15%,8%)] border-[hsl(210,15%,18%)] text-[hsl(210,20%,90%)] placeholder:text-[hsl(210,10%,40%)] font-mono text-sm focus:border-[hsl(185,100%,50%)] focus:ring-1 focus:ring-[hsl(185,100%,50%)]"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(210,15%,8%)] border border-[hsl(210,15%,18%)] rounded shadow-xl z-50 max-h-64 overflow-y-auto">
          {filtered.map((product) => (
            <button
              key={product.product_id}
              onClick={() => {
                onSelectCoin(product)
                onValueChange("")
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left hover:bg-[hsl(210,15%,14%)] flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded bg-[hsl(185,100%,50%)] flex items-center justify-center text-black text-xs font-bold font-mono flex-shrink-0">
                {product.base_currency.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[hsl(210,20%,90%)] truncate">{product.base_name}</div>
                <div className="text-xs text-[hsl(210,10%,55%)] font-mono">{product.product_id}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && value.length > 0 && filtered.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[hsl(210,15%,8%)] border border-[hsl(210,15%,18%)] rounded shadow-xl z-50 p-3">
          <p className="text-sm text-[hsl(210,10%,55%)]">No matching coins found</p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
}: { label: string; value: string; subValue?: string; icon: any }) {
  const isPositive = subValue?.startsWith("+")
  const isNegative = subValue?.startsWith("-")

  return (
    <div className="terminal-card p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[hsl(185,100%,50%)]" />
        <span className="text-xs text-[hsl(210,10%,55%)] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-[hsl(210,20%,90%)] font-mono">{value}</div>
      {subValue && (
        <div
          className={`text-xs sm:text-sm font-mono mt-1 ${isPositive ? "text-gain" : isNegative ? "text-loss" : "text-[hsl(210,10%,55%)]"}`}
        >
          {subValue}
        </div>
      )}
    </div>
  )
}

// Main Component
export default function MomentumTracker() {
  const router = useRouter()

  // State
  const [watchlist, setWatchlist] = useState<CoinData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [raceActive, setRaceActive] = useState(false)
  const [racePaused, setRacePaused] = useState(false)
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [momentumTimeframe, setMomentumTimeframe] = useState<MomentumTimeframe>("1m")
  const [sortField, setSortField] = useState<SortField>("sessionROC")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")

  // Get product IDs for WebSocket subscription
  const productIds = useMemo(() => watchlist.map((c) => c.coinbaseId), [watchlist])
  const { book, status, error } = useCoinbase(productIds)
  const { products } = useCoinbaseProducts()

  // Update coins from WebSocket data
  const updateCoinsRef = useRef<() => void>()
  updateCoinsRef.current = () => {
    if (Object.keys(book).length === 0) return

    setWatchlist((prev) => {
      let changed = false
      const updated = prev.map((coin) => {
        const series = book[coin.coinbaseId]
        if (!series || series.length === 0) return coin

        const latest = series[series.length - 1]
        if (latest.price === coin.currentPrice && latest.ts === coin.lastUpdated) return coin

        changed = true
        const history: PricePoint[] = series.slice(-OPTIMAL_BUFFER_SIZE).map((p) => ({
          price: p.price,
          timestamp: p.ts,
        }))

        const sessionROC =
          raceActive && coin.sessionStartPrice > 0 ? calculateSessionROC(latest.price, coin.sessionStartPrice) : 0

        const timeframeMs = getTimeframeMs(momentumTimeframe)
        const momentum = calculateMomentum(history, timeframeMs)

        return {
          ...coin,
          currentPrice: latest.price,
          priceHistory: history,
          sessionROC,
          momentum,
          lastUpdated: latest.ts,
        }
      })

      return changed ? updated : prev
    })
  }

  // Throttled update effect
  useEffect(() => {
    if (Object.keys(book).length === 0) return

    const interval = setInterval(() => {
      updateCoinsRef.current?.()
    }, 500)

    // Initial update
    updateCoinsRef.current?.()

    return () => clearInterval(interval)
  }, [book])

  // Elapsed time timer
  useEffect(() => {
    if (!raceActive || racePaused || !raceStartTime) return

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - raceStartTime)
    }, 1000)

    return () => clearInterval(interval)
  }, [raceActive, racePaused, raceStartTime])

  // Add coin to watchlist
  const addCoin = useCallback((product: CoinbaseProduct) => {
    setWatchlist((prev) => {
      if (prev.some((c) => c.coinbaseId === product.product_id)) return prev

      const newCoin: CoinData = {
        id: generateCoinId(product.base_currency),
        symbol: product.base_currency,
        name: product.base_name,
        coinbaseId: product.product_id,
        currentPrice: 0,
        sessionStartPrice: 0,
        sessionStartTime: 0,
        sessionROC: 0,
        momentum: 0,
        lastUpdated: 0,
        priceHistory: [],
      }

      return [...prev, newCoin]
    })
  }, [])

  // Remove coin from watchlist
  const removeCoin = useCallback((id: string) => {
    setWatchlist((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // Start race
  const startRace = useCallback(() => {
    if (watchlist.length === 0) return

    const now = Date.now()
    setRaceStartTime(now)
    setRaceActive(true)
    setRacePaused(false)
    setElapsedTime(0)

    setWatchlist((prev) =>
      prev.map((coin) => ({
        ...coin,
        sessionStartPrice: coin.currentPrice || 0,
        sessionStartTime: now,
        sessionROC: 0,
      })),
    )
  }, [watchlist.length])

  // Pause/Resume race
  const togglePause = useCallback(() => {
    setRacePaused((p) => !p)
  }, [])

  // Reset race
  const resetRace = useCallback(() => {
    setRaceActive(false)
    setRacePaused(false)
    setRaceStartTime(null)
    setElapsedTime(0)

    setWatchlist((prev) =>
      prev.map((coin) => ({
        ...coin,
        sessionStartPrice: 0,
        sessionStartTime: 0,
        sessionROC: 0,
      })),
    )
  }, [])

  // Sorted watchlist
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      if (sortField === "sessionROC") return b.sessionROC - a.sessionROC
      if (sortField === "momentum") return b.momentum - a.momentum
      return b.currentPrice - a.currentPrice
    })
  }, [watchlist, sortField])

  // Leaders
  const leader = sortedWatchlist[0]
  const fastestMover = [...watchlist].sort((a, b) => b.momentum - a.momentum)[0]

  // Navigate to coin page
  const goToCoin = (symbol: string) => {
    router.push(`/coin/${symbol.toLowerCase()}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[hsl(210,15%,18%)] bg-[var(--surface)]">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
          <Brand />
          <ConnectionIndicator status={status} error={error} />
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-[hsl(210,15%,18%)] bg-[var(--surface)]">
        <div className="container mx-auto px-3 sm:px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard label="Watchlist" value={watchlist.length.toString()} icon={Activity} />
            <StatCard label="Elapsed" value={raceActive ? formatElapsedTime(elapsedTime) : "0:00"} icon={Activity} />
            <StatCard
              label="Leader"
              value={leader?.symbol || "—"}
              subValue={leader && raceActive ? formatPercentage(leader.sessionROC) : undefined}
              icon={TrendingUp}
            />
            <StatCard
              label="Fastest"
              value={fastestMover?.symbol || "—"}
              subValue={fastestMover ? `${formatPercentage(fastestMover.momentum)}/${momentumTimeframe}` : undefined}
              icon={Activity}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-b border-[hsl(210,15%,18%)] bg-[var(--surface)]">
        <div className="container mx-auto px-3 sm:px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* View Toggle & Timeframe */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-[hsl(210,15%,8%)] rounded p-0.5 border border-[hsl(210,15%,18%)]">
                <button
                  onClick={() => setActiveTab("table")}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    activeTab === "table"
                      ? "bg-[hsl(185,100%,50%)] text-black"
                      : "text-[hsl(210,10%,55%)] hover:text-[hsl(210,20%,90%)]"
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setActiveTab("chart")}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    activeTab === "chart"
                      ? "bg-[hsl(185,100%,50%)] text-black"
                      : "text-[hsl(210,10%,55%)] hover:text-[hsl(210,20%,90%)]"
                  }`}
                >
                  Chart
                </button>
              </div>

              <MomentumTimeframeSelector timeframe={momentumTimeframe} onTimeframeChange={setMomentumTimeframe} />
            </div>

            {/* Search & Add */}
            <div className="flex items-center gap-2 flex-1">
              <AddCoinTypeahead
                value={searchQuery}
                onValueChange={setSearchQuery}
                existingSymbols={watchlist.map((c) => c.coinbaseId)}
                onSelectCoin={addCoin}
                onAddFirstMatch={() => {}}
              />

              <Button
                onClick={addCoin.bind(null, {
                  product_id: "",
                  base_currency: "",
                  quote_currency: "",
                  base_name: "",
                  status: "",
                  trading_disabled: false,
                })}
                disabled={!searchQuery}
                size="sm"
                className="bg-[hsl(185,100%,50%)] hover:bg-[hsl(185,100%,45%)] text-black font-mono h-9 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Race Controls */}
            <div className="flex items-center gap-2">
              {!raceActive ? (
                <Button
                  onClick={startRace}
                  disabled={watchlist.length === 0}
                  size="sm"
                  className="bg-[hsl(185,100%,50%)] hover:bg-[hsl(185,100%,45%)] text-black font-mono h-9"
                >
                  <Flag className="w-4 h-4 mr-1" />
                  Start
                </Button>
              ) : (
                <>
                  <Button
                    onClick={togglePause}
                    size="sm"
                    variant="outline"
                    className="border-[hsl(210,15%,18%)] text-[hsl(210,20%,90%)] hover:bg-[hsl(210,15%,14%)] font-mono h-9 bg-transparent"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    {racePaused ? "Resume" : "Pause"}
                  </Button>
                  <Button
                    onClick={resetRace}
                    size="sm"
                    variant="outline"
                    className="border-[hsl(210,15%,18%)] text-[hsl(210,20%,90%)] hover:bg-[hsl(210,15%,14%)] font-mono h-9 bg-transparent"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto px-3 sm:px-4 py-4 h-full">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Activity className="w-12 h-12 text-[hsl(210,10%,30%)] mb-4" />
              <h3 className="text-lg font-semibold text-[hsl(210,20%,90%)] mb-2">No Coins Added</h3>
              <p className="text-sm text-[hsl(210,10%,55%)] max-w-sm">
                Search for coins above to add them to your watchlist and start tracking momentum.
              </p>
            </div>
          ) : activeTab === "table" ? (
            <div className="terminal-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[hsl(210,15%,18%)] hover:bg-transparent">
                      <TableHead className="text-[hsl(210,10%,55%)] font-mono text-xs uppercase">Asset</TableHead>
                      <TableHead className="text-[hsl(210,10%,55%)] font-mono text-xs uppercase text-right">
                        Price
                      </TableHead>
                      <TableHead className="text-[hsl(210,10%,55%)] font-mono text-xs uppercase text-right">
                        <button
                          onClick={() => setSortField("sessionROC")}
                          className={`hover:text-[hsl(185,100%,50%)] ${sortField === "sessionROC" ? "text-[hsl(185,100%,50%)]" : ""}`}
                        >
                          Change %
                        </button>
                      </TableHead>
                      <TableHead className="text-[hsl(210,10%,55%)] font-mono text-xs uppercase text-right">
                        <button
                          onClick={() => setSortField("momentum")}
                          className={`hover:text-[hsl(185,100%,50%)] ${sortField === "momentum" ? "text-[hsl(185,100%,50%)]" : ""}`}
                        >
                          ROC ({momentumTimeframe})
                        </button>
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWatchlist.map((coin, index) => (
                      <TableRow
                        key={coin.id}
                        onClick={() => goToCoin(coin.symbol)}
                        className="border-b border-[hsl(210,15%,12%)] cursor-pointer hover:bg-[hsl(210,15%,8%)] transition-colors"
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded flex items-center justify-center text-black text-xs font-bold font-mono flex-shrink-0"
                              style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                            >
                              {coin.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-[hsl(210,20%,90%)]">{coin.symbol}</div>
                              <div className="text-xs text-[hsl(210,10%,55%)]">{coin.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[hsl(210,20%,90%)]">
                          ${formatPrice(coin.currentPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono ${coin.sessionROC >= 0 ? "text-gain" : "text-loss"}`}>
                            {raceActive ? formatPercentage(coin.sessionROC) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono ${coin.momentum >= 0 ? "text-gain" : "text-loss"}`}>
                            {formatPercentage(coin.momentum)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeCoin(coin.id)
                            }}
                            className="h-8 w-8 p-0 text-[hsl(210,10%,45%)] hover:text-[hsl(25,100%,50%)] hover:bg-[hsl(210,15%,12%)]"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="terminal-card p-4 h-full flex flex-col">
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-[hsl(210,10%,30%)] mx-auto mb-4" />
                <p className="text-[hsl(210,10%,55%)]">Chart view coming soon</p>
                <p className="text-xs text-[hsl(210,10%,40%)] mt-2">Real-time momentum visualization</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
