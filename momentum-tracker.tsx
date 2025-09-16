"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  RotateCcw,
  Plus,
  X,
  Search,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Activity,
  BarChart3,
  List,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  Star,
  Trophy,
  Flag,
  Pause,
  Grid3X3,
} from "lucide-react"
import { AddCoinModal } from "./components/ui/add-coin-modal"

// Types
interface CoinData {
  id: string
  symbol: string
  name: string
  currentPrice: number
  startPrice: number
  changesSinceStart: number
  normalizedPrice?: number
  dailyChange: number
  change5min?: number
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

type SortField = "changesSinceStart" | "rateOfChange" | "dailyChange" | "currentPrice"
type SortDirection = "asc" | "desc"
type TimeFrame = "1min" | "5min" | "15min" | "1h" | "1d"

// Mock WebSocket data for preview
const MOCK_COINS = [
  { symbol: "BTCUSDT", name: "Bitcoin", basePrice: 67234.56 },
  { symbol: "ETHUSDT", name: "Ethereum", basePrice: 3456.78 },
  { symbol: "SOLUSDT", name: "Solana", basePrice: 189.45 },
  { symbol: "ADAUSDT", name: "Cardano", basePrice: 0.4567 },
  { symbol: "DOGEUSDT", name: "Dogecoin", basePrice: 0.0847 },
  { symbol: "AVAXUSDT", name: "Avalanche", basePrice: 34.56 },
  { symbol: "UNIUSDT", name: "Uniswap", basePrice: 8.42 },
  { symbol: "LINKUSDT", name: "Chainlink", basePrice: 14.23 },
]

// Coin colors for race chart
const COIN_COLORS = [
  "#8b5cf6", // Purple
  "#10b981", // Green
  "#f59e0b", // Yellow
  "#ef4444", // Red
  "#3b82f6", // Blue
  "#f97316", // Orange
  "#ec4899", // Pink
  "#06b6d4", // Cyan
]

// Generate unique ID for coins
const generateCoinId = (symbol: string) => `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), wait)
  }) as T
}

// Throttle utility
function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }) as T
}

// Enhanced WebSocket Hook with debouncing/throttling
const useWebSocket = (symbols: string[], timeFrame: TimeFrame) => {
  const [data, setData] = useState<Map<string, number>>(new Map())
  const intervalRef = useRef<NodeJS.Timeout>()
  const lastUpdateRef = useRef<Map<string, number>>(new Map())

  // Get update interval based on timeframe
  const getUpdateInterval = (tf: TimeFrame): number => {
    switch (tf) {
      case "1min":
        return 500
      case "5min":
        return 1000
      case "15min":
        return 2000
      case "1h":
        return 5000
      case "1d":
        return 10000
      default:
        return 1000
    }
  }

  // Throttled update function for smooth price movements
  const throttledUpdate = useMemo(
    () =>
      throttle((newData: Map<string, number>) => {
        setData(newData)
      }, 150), // Slower for smoother transitions
    [],
  )

  useEffect(() => {
    if (symbols.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    // Initialize prices for new symbols
    symbols.forEach((symbol) => {
      if (!lastUpdateRef.current.has(symbol)) {
        const mockCoin = MOCK_COINS.find((c) => c.symbol === symbol)
        if (mockCoin) {
          lastUpdateRef.current.set(symbol, mockCoin.basePrice)
          setData((prev) => new Map(prev.set(symbol, mockCoin.basePrice)))
        }
      }
    })

    const updateInterval = getUpdateInterval(timeFrame)

    // Mock WebSocket with realistic price movements
    intervalRef.current = setInterval(() => {
      const newData = new Map()
      symbols.forEach((symbol) => {
        const mockCoin = MOCK_COINS.find((c) => c.symbol === symbol)
        if (mockCoin) {
          // Generate realistic price movement based on timeframe
          const volatility = symbol.includes("DOGE") ? 0.008 : symbol.includes("BTC") ? 0.001 : 0.004

          const change = (Math.random() - 0.5) * volatility
          const currentPrice = lastUpdateRef.current.get(symbol) || mockCoin.basePrice
          const newPrice = Math.max(currentPrice * (1 + change), mockCoin.basePrice * 0.9)

          lastUpdateRef.current.set(symbol, newPrice)
          newData.set(symbol, newPrice)
        }
      })
      throttledUpdate(newData)
    }, updateInterval)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [symbols.join(","), timeFrame, throttledUpdate])

  return data
}

// Utility functions
const calculateChangesSinceStart = (currentPrice: number, startPrice: number): number => {
  if (!startPrice) return 0
  return ((currentPrice - startPrice) / startPrice) * 100
}

const calculateRateOfChange = (priceHistory: Array<{ price: number; timestamp: number }>): number => {
  if (priceHistory.length < 2) return 0

  // Calculate slope of recent price changes (last 60 seconds)
  const now = Date.now()
  const recentHistory = priceHistory.filter((p) => now - p.timestamp <= 60000)

  if (recentHistory.length < 2) return 0

  const timeSpan = recentHistory[recentHistory.length - 1].timestamp - recentHistory[0].timestamp
  const priceChange = recentHistory[recentHistory.length - 1].price - recentHistory[0].price
  const startPrice = recentHistory[0].price

  if (timeSpan === 0 || startPrice === 0) return 0

  // Rate of change as % per minute
  return ((priceChange / startPrice) * 100 * 60000) / timeSpan
}

const formatPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%`
}

// Enhanced Race Chart Component
function RaceChart({
  coins,
  startTime,
  timeFrame,
}: { coins: CoinData[]; startTime: number | null; timeFrame: TimeFrame }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const previousDataRef = useRef<Map<string, number>>(new Map())

  const smoothChartUpdate = useCallback(
    (ctx: CanvasRenderingContext2D, rect: DOMRect) => {
      if (!startTime || coins.length === 0) return

      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height)

      const padding = 40
      const chartWidth = rect.width - padding * 2
      const chartHeight = rect.height - padding * 2

      // Get all normalized prices for bounds calculation
      const allNormalizedPrices = coins.flatMap((coin) =>
        coin.priceHistory.filter((p) => p.timestamp >= startTime).map((p) => p.changesSinceStart),
      )

      if (allNormalizedPrices.length === 0) return

      const minChange = Math.min(...allNormalizedPrices, -1)
      const maxChange = Math.max(...allNormalizedPrices, 1)
      const changeRange = Math.max(maxChange - minChange, 2)

      // Draw grid lines
      ctx.strokeStyle = "#374151"
      ctx.lineWidth = 0.5
      ctx.setLineDash([2, 2])

      // Horizontal grid lines
      const gridLevels = 6
      for (let i = 0; i <= gridLevels; i++) {
        const y = padding + (i / gridLevels) * chartHeight
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(padding + chartWidth, y)
        ctx.stroke()

        // Y-axis labels
        const changeValue = maxChange - (i / gridLevels) * changeRange
        ctx.fillStyle = "#9ca3af"
        ctx.font = "10px monospace"
        ctx.textAlign = "right"
        ctx.fillText(`${changeValue.toFixed(1)}%`, padding - 5, y + 3)
      }

      // Draw zero line
      const zeroY = padding + ((maxChange - 0) / changeRange) * chartHeight
      ctx.setLineDash([])
      ctx.strokeStyle = "#6b7280"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(padding, zeroY)
      ctx.lineTo(padding + chartWidth, zeroY)
      ctx.stroke()

      // Draw race lines for each coin with smooth interpolation
      coins.forEach((coin, index) => {
        const chartData = coin.priceHistory.filter((p) => p.timestamp >= startTime)
        if (chartData.length < 2) return

        const color = COIN_COLORS[index % COIN_COLORS.length]
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.setLineDash([])

        // Smooth line drawing with bezier curves
        ctx.beginPath()
        chartData.forEach((point, pointIndex) => {
          const x = padding + (pointIndex / (chartData.length - 1)) * chartWidth
          const y = padding + ((maxChange - point.changesSinceStart) / changeRange) * chartHeight

          if (pointIndex === 0) {
            ctx.moveTo(x, y)
          } else if (pointIndex === 1) {
            ctx.lineTo(x, y)
          } else {
            // Use quadratic curves for smoother lines
            const prevPoint = chartData[pointIndex - 1]
            const prevX = padding + ((pointIndex - 1) / (chartData.length - 1)) * chartWidth
            const prevY = padding + ((maxChange - prevPoint.changesSinceStart) / changeRange) * chartHeight

            const cpX = (prevX + x) / 2
            const cpY = (prevY + y) / 2
            ctx.quadraticCurveTo(cpX, cpY, x, y)
          }
        })
        ctx.stroke()

        // Add glow effect
        ctx.shadowColor = color
        ctx.shadowBlur = 2
        ctx.stroke()
        ctx.shadowBlur = 0

        // Draw current position dot with smooth animation
        if (chartData.length > 0) {
          const lastPoint = chartData[chartData.length - 1]
          const x = padding + chartWidth
          const y = padding + ((maxChange - lastPoint.changesSinceStart) / changeRange) * chartHeight

          // Animate dot position
          const previousY = previousDataRef.current.get(coin.id) || y
          const animatedY = previousY + (y - previousY) * 0.1
          previousDataRef.current.set(coin.id, animatedY)

          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, animatedY, 4, 0, 2 * Math.PI)
          ctx.fill()

          // Add coin label
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px monospace"
          ctx.textAlign = "left"
          ctx.fillText(coin.symbol, x + 8, animatedY + 4)
        }
      })

      // Time axis labels
      if (coins.length > 0 && coins[0].priceHistory.length > 0) {
        const firstCoinData = coins[0].priceHistory.filter((p) => p.timestamp >= startTime)
        if (firstCoinData.length > 0) {
          const timeRange = firstCoinData[firstCoinData.length - 1].timestamp - firstCoinData[0].timestamp
          const timeGridLines = 4

          for (let i = 0; i <= timeGridLines; i++) {
            const x = padding + (i / timeGridLines) * chartWidth
            const timeValue = firstCoinData[0].timestamp + (i / timeGridLines) * timeRange
            const timeLabel = new Date(timeValue).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

            ctx.fillStyle = "#9ca3af"
            ctx.font = "10px monospace"
            ctx.textAlign = "center"
            ctx.fillText(timeLabel, x, padding + chartHeight + 15)
          }
        }
      }
    },
    [coins, startTime],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set proper scaling for retina displays
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Smooth animation loop
    const animate = () => {
      smoothChartUpdate(ctx, rect)
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [smoothChartUpdate])

  if (!startTime || coins.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Start a race to see the momentum chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
    </div>
  )
}

// Animated Live Race Leaderboard Component
function RaceLeaderboard({ coins, isRaceMode }: { coins: CoinData[]; isRaceMode: boolean }) {
  const [sortedCoins, setSortedCoins] = useState<CoinData[]>([])

  useEffect(() => {
    if (isRaceMode && coins.length > 0) {
      const newSortedCoins = [...coins].sort((a, b) => b.normalizedPrice - a.normalizedPrice)
      newSortedCoins.forEach((coin, index) => {
        coin.previousPosition = coin.racePosition
        coin.racePosition = index + 1
      })
      setSortedCoins(newSortedCoins)
    } else {
      setSortedCoins([])
    }
  }, [coins, isRaceMode])

  if (!isRaceMode || coins.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-bold text-white">Live Rankings</h3>
      </div>
      <div className="space-y-2">
        {sortedCoins.map((coin, index) => (
          <div
            key={coin.id}
            className={`flex justify-between items-center py-2 px-3 rounded-lg transition-all duration-500 ease-out transform ${
              index === 0
                ? "bg-yellow-500/20 border border-yellow-500/30 scale-105"
                : index === 1
                  ? "bg-gray-500/20 border border-gray-500/30"
                  : index === 2
                    ? "bg-orange-500/20 border border-orange-500/30"
                    : "bg-gray-800/30"
            }`}
            style={{
              transform: `translateY(${
                coin.previousPosition && coin.previousPosition !== coin.racePosition
                  ? (coin.previousPosition - coin.racePosition) * 10
                  : 0
              }px)`,
              transition:
                "transform 0.5s ease-out, background-color 0.3s ease-out, border-color 0.3s ease-out, scale 0.3s ease-out",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <span
                  className={`text-lg font-bold transition-colors duration-300 ${
                    index === 0
                      ? "text-yellow-400"
                      : index === 1
                        ? "text-gray-400"
                        : index === 2
                          ? "text-orange-400"
                          : "text-gray-500"
                  }`}
                >
                  #{index + 1}
                </span>
                {/* Position change indicator */}
                {coin.previousPosition && coin.previousPosition !== coin.racePosition && (
                  <div
                    className={`absolute -top-1 -right-1 text-xs ${
                      coin.racePosition < coin.previousPosition ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {coin.racePosition < coin.previousPosition ? "↑" : "↓"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full transition-all duration-300"
                  style={{ backgroundColor: COIN_COLORS[coins.indexOf(coin) % COIN_COLORS.length] }}
                />
                <span className="font-semibold text-white text-sm">{coin.symbol}</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-bold transition-colors duration-300 ${
                  coin.normalizedPrice >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatPercentage(coin.normalizedPrice)}
              </span>
              <div className="text-xs text-gray-400">{coin.rateOfChange.toFixed(2)}%/min</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Time Frame Selector Component
function TimeFrameSelector({
  timeFrame,
  onTimeFrameChange,
}: { timeFrame: TimeFrame; onTimeFrameChange: (tf: TimeFrame) => void }) {
  const timeFrameOptions: TimeFrame[] = ["1min", "5min", "15min", "1h", "1d"]

  return (
    <div className="flex items-center gap-1 bg-[#2a2d3a] rounded-lg p-1">
      {timeFrameOptions.map((tf) => (
        <button
          key={tf}
          onClick={() => onTimeFrameChange(tf)}
          className={`px-3 py-1.5 rounded-md text-sm transition-all font-medium ${
            timeFrame === tf ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

// Race Controls Component
function RaceControls({
  isRaceMode,
  onStartRace,
  onStopRace,
  isTracking,
  coinCount,
}: {
  isRaceMode: boolean
  onStartRace: () => void
  onStopRace: () => void
  isTracking: boolean
  coinCount: number
}) {
  return (
    <div className="flex items-center gap-3">
      {!isRaceMode ? (
        <button
          onClick={onStartRace}
          disabled={coinCount === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg transition-all disabled:cursor-not-allowed text-sm font-medium"
        >
          <Flag className="h-4 w-4" />
          Start Race (Normalize to 0%)
        </button>
      ) : (
        <button
          onClick={onStopRace}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white rounded-lg transition-all text-sm font-medium"
        >
          <Pause className="h-4 w-4" />
          Stop Race
        </button>
      )}
    </div>
  )
}

// Mini Sparkline Component
function MiniSparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) return <div className="w-16 h-6" />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 60
      const y = 20 - ((value - min) / range) * 16
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width="60" height="20" className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        opacity="0.8"
      />
    </svg>
  )
}

// Add Coin Modal Component
// function AddCoinModal({
//   isOpen,
//   onClose,
//   onAdd,
//   existingSymbols,
// }: {
//   isOpen: boolean
//   onClose: () => void
//   onAdd: (coin: any) => void
//   existingSymbols: string[]
// }) {
//   const [searchTerm, setSearchTerm] = useState("")

//   const filteredCoins = MOCK_COINS.filter(
//     (coin) =>
//       !existingSymbols.includes(coin.symbol) &&
//       (coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         coin.name.toLowerCase().includes(searchTerm.toLowerCase())),
//   )

//   if (!isOpen) return null

//   return (
//     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
//       <div className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 p-6 w-full max-w-md max-h-96">
//         <div className="flex items-center justify-between mb-4">
//           <h3 className="text-lg font-bold text-white">Add Coin to Watchlist</h3>
//           <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
//             <X className="h-5 w-5" />
//           </button>
//         </div>

//         <div className="relative mb-4">
//           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//           <input
//             type="text"
//             placeholder="Search coins..."
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             className="w-full pl-10 pr-4 py-2 bg-[#2a2d3a] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
//           />
//         </div>

//         <div className="space-y-2 max-h-48 overflow-y-auto">
//           {filteredCoins.map((coin) => (
//             <button
//               key={coin.symbol}
//               onClick={() => {
//                 onAdd(coin)
//                 onClose()
//                 setSearchTerm("")
//               }}
//               className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#2a2d3a] hover:bg-[#3a3d4a] transition-colors text-left"
//             >
//               <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
//                 {coin.symbol.charAt(0)}
//               </div>
//               <div className="flex-1 min-w-0">
//                 <div className="font-semibold text-white text-sm truncate">{coin.symbol}</div>
//                 <div className="text-xs text-gray-400 truncate">{coin.name}</div>
//               </div>
//             </button>
//           ))}
//           {filteredCoins.length === 0 && (
//             <div className="text-center py-4 text-gray-400 text-sm">
//               {existingSymbols.length === MOCK_COINS.length ? "All coins already added" : "No coins found"}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }

// Reset Confirmation Modal
function ResetConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 p-6 w-full max-w-md">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="h-6 w-6 text-orange-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Reset Momentum Tracking?</h3>
          <p className="text-gray-400 mb-6 text-sm">
            This will reset all "% Since Start" calculations to 0% and clear the marked start time. Your watchlist will
            remain intact.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[#2a2d3a] border border-gray-700 hover:bg-[#3a3d4a] text-white rounded-lg transition-colors text-center text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm()
                onClose()
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg transition-all text-center text-sm font-medium"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MomentumTracker() {
  const [watchlistData, setWatchlistData] = useState<WatchlistData>({
    startTime: null,
    coins: [],
  })
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortField>("changesSinceStart")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [isTracking, setIsTracking] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "chart">("table")
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null)
  const [liveMomentumMode, setLiveMomentumMode] = useState(false)
  const [isRaceMode, setIsRaceMode] = useState(false)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1min")
  const [searchTerm, setSearchTerm] = useState("")
  const [watchlistViewMode, setWatchlistViewMode] = useState<"table" | "cards">("table")

  const symbols = watchlistData.coins.map((coin) => coin.symbol)
  const priceData = useWebSocket(symbols, timeFrame)

  // Debounced update function for smooth state updates
  const debouncedUpdateCoins = useMemo(
    () =>
      debounce((updatedCoins: CoinData[]) => {
        setWatchlistData((prev) => ({
          ...prev,
          coins: updatedCoins,
        }))
      }, 100), // Slightly slower for smoother transitions
    [],
  )

  // Update coin data when new price data arrives
  useEffect(() => {
    if (priceData.size === 0) return

    const updatedCoins = watchlistData.coins.map((coin) => {
      const newPrice = priceData.get(coin.symbol)
      if (!newPrice) return coin

      const now = Date.now()
      const changesSinceStart = calculateChangesSinceStart(newPrice, coin.startPrice)
      const normalizedPrice = isRaceMode ? changesSinceStart : coin.normalizedPrice

      const newPriceHistory = [
        ...coin.priceHistory.slice(-100), // Keep last 100 points
        { price: newPrice, timestamp: now, changesSinceStart },
      ]

      return {
        ...coin,
        currentPrice: newPrice,
        changesSinceStart,
        normalizedPrice,
        rateOfChange: calculateRateOfChange(newPriceHistory),
        lastUpdated: now,
        priceHistory: newPriceHistory,
      }
    })

    // Update race positions with smooth transitions
    if (isRaceMode) {
      const sortedByPerformance = [...updatedCoins].sort((a, b) => b.normalizedPrice - a.normalizedPrice)
      sortedByPerformance.forEach((coin, index) => {
        coin.previousPosition = coin.racePosition
        coin.racePosition = index + 1
      })
    }

    debouncedUpdateCoins(updatedCoins)
  }, [priceData, watchlistData.coins, isRaceMode, debouncedUpdateCoins])

  const startRace = useCallback(() => {
    const now = Date.now()
    setWatchlistData((prev) => ({
      startTime: now,
      coins: prev.coins.map((coin) => ({
        ...coin,
        startPrice: coin.currentPrice,
        changesSinceStart: 0,
        normalizedPrice: 0,
        priceHistory: [{ price: coin.currentPrice, timestamp: now, changesSinceStart: 0 }],
        racePosition: 1,
        previousPosition: 1,
      })),
    }))
    setIsTracking(true)
    setIsRaceMode(true)
    setViewMode("chart")
  }, [])

  const stopRace = useCallback(() => {
    setIsRaceMode(false)
  }, [])

  const markStartTime = useCallback(() => {
    const now = Date.now()
    setWatchlistData((prev) => ({
      startTime: now,
      coins: prev.coins.map((coin) => ({
        ...coin,
        startPrice: coin.currentPrice,
        changesSinceStart: 0,
        priceHistory: [{ price: coin.currentPrice, timestamp: now, changesSinceStart: 0 }],
      })),
    }))
    setIsTracking(true)
  }, [])

  const addCoin = useCallback(
    (coinInfo: any) => {
      const currentPrice = priceData.get(coinInfo.symbol) || coinInfo.basePrice
      const now = Date.now()

      const newCoin: CoinData = {
        id: generateCoinId(coinInfo.symbol),
        symbol: coinInfo.symbol,
        name: coinInfo.name,
        currentPrice,
        startPrice: watchlistData.startTime ? currentPrice : 0,
        changesSinceStart: 0,
        normalizedPrice: 0,
        dailyChange: (Math.random() - 0.5) * 10, // Mock daily change
        change5min: (Math.random() - 0.5) * 2, // Mock 5min change
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
    },
    [priceData, watchlistData.startTime],
  )

  const removeCoin = useCallback((id: string) => {
    setWatchlistData((prev) => ({
      ...prev,
      coins: prev.coins.filter((coin) => coin.id !== id),
    }))
    // Clear selection if removed coin was selected
    setSelectedCoin((prev) => (prev?.id === id ? null : prev))
  }, [])

  const resetTracking = useCallback(() => {
    setWatchlistData((prev) => ({
      ...prev,
      startTime: null,
      coins: prev.coins.map((coin) => ({
        ...coin,
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
    setSelectedCoin(null)
  }, [])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
      } else {
        setSortBy(field)
        setSortDirection("desc")
      }
    },
    [sortBy, sortDirection],
  )

  // Sort coins with smooth transitions
  const sortedCoins = useMemo(() => {
    return [...watchlistData.coins].sort((a, b) => {
      let aValue: number, bValue: number

      switch (sortBy) {
        case "changesSinceStart":
          aValue = a.changesSinceStart
          bValue = b.changesSinceStart
          break
        case "rateOfChange":
          aValue = Math.abs(a.rateOfChange)
          bValue = Math.abs(b.rateOfChange)
          break
        case "dailyChange":
          aValue = a.dailyChange
          bValue = b.dailyChange
          break
        case "currentPrice":
          aValue = a.currentPrice
          bValue = b.currentPrice
          break
        default:
          return 0
      }

      return sortDirection === "desc" ? bValue - aValue : aValue - bValue
    })
  }, [watchlistData.coins, sortBy, sortDirection])

  const bestPerformer = sortedCoins.find((coin) => coin.changesSinceStart > 0) || sortedCoins[0]
  const fastestMover = [...sortedCoins].sort((a, b) => Math.abs(b.rateOfChange) - Math.abs(a.rateOfChange))[0]

  // Check if coin should pulse (gaining >0.5%/minute)
  const shouldPulse = useCallback(
    (coin: CoinData) => {
      return liveMomentumMode && coin.rateOfChange > 0.5
    },
    [liveMomentumMode],
  )

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center justify-center gap-1 text-gray-400 hover:text-white transition-colors text-sm font-bold"
    >
      {children}
      {sortBy === field &&
        (sortDirection === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
    </button>
  )

  // Filter coins based on search term
  const filteredCoins = useMemo(() => {
    if (!searchTerm) return sortedCoins
    return sortedCoins.filter(
      (coin) =>
        coin.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coin.name.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [sortedCoins, searchTerm])

  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {filteredCoins.map((coin, index) => (
        <div
          key={coin.id}
          className={`bg-gradient-to-br from-[#2a2d3a] to-[#252631] rounded-xl p-4 border border-gray-700/50 transition-all duration-300 ease-out hover:bg-gray-800/30 ${
            shouldPulse(coin) ? "animate-pulse border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20" : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
              >
                {coin.symbol.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-white text-sm">{coin.symbol}</div>
                <div className="text-xs text-gray-400">{coin.name}</div>
              </div>
            </div>
            <button
              onClick={() => removeCoin(coin.id)}
              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Price</span>
              <span className="text-white font-mono">${formatPrice(coin.currentPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">{isRaceMode ? "Race %" : "Since Start"}</span>
              <span
                className={`font-semibold ${
                  (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) > 0
                    ? "text-green-400"
                    : (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) < 0
                      ? "text-red-400"
                      : "text-gray-400"
                }`}
              >
                {watchlistData.startTime
                  ? formatPercentage(isRaceMode ? coin.normalizedPrice : coin.changesSinceStart)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 text-sm">Rate</span>
              <span
                className={`text-sm ${
                  Math.abs(coin.rateOfChange) > 0.5
                    ? coin.rateOfChange > 0
                      ? "text-green-400"
                      : "text-red-400"
                    : "text-gray-400"
                }`}
              >
                {coin.rateOfChange.toFixed(2)}%/min
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (viewMode === "chart") {
    return (
      <div
        className="dashboard-container"
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          background: "linear-gradient(135deg, #1a1b23 0%, #1e1f2a 50%, #1a1b23 100%)",
        }}
      >
        {/* Header */}
        <div className="bg-[#21222d]/80 backdrop-blur-xl border-b border-gray-800/50">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setViewMode("table")}
                  className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Table
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    {isRaceMode ? (
                      <Flag className="h-4 w-4 text-white" />
                    ) : (
                      <BarChart3 className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">{isRaceMode ? "Race Mode" : "Chart View"}</h1>
                    <p className="text-xs text-gray-400">
                      {isRaceMode ? "Live momentum race" : "Momentum visualization"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Time Frame Selector */}
                <TimeFrameSelector timeFrame={timeFrame} onTimeFrameChange={setTimeFrame} />

                {/* Live Momentum Toggle */}
                <button
                  onClick={() => setLiveMomentumMode(!liveMomentumMode)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                    liveMomentumMode
                      ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                      : "bg-[#2a2d3a] border border-gray-700 hover:bg-[#3a3d4a] text-gray-400 hover:text-white"
                  }`}
                >
                  <Star className="h-4 w-4" />
                  Live Momentum
                </button>

                {/* Race Controls */}
                <RaceControls
                  isRaceMode={isRaceMode}
                  onStartRace={startRace}
                  onStopRace={stopRace}
                  isTracking={isTracking}
                  coinCount={watchlistData.coins.length}
                />

                <button
                  onClick={() => setIsResetModalOpen(true)}
                  disabled={!isTracking}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2a2d3a] border border-gray-700 hover:bg-[#3a3d4a] disabled:opacity-50 text-white rounded-lg transition-all disabled:cursor-not-allowed text-sm font-medium"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div
          className="dashboard-content"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr 1fr",
            gap: "1rem",
            minHeight: 0,
            padding: "1.5rem",
          }}
        >
          {/* Left Sidebar - Stats Cards */}
          <div className="space-y-4" style={{ minHeight: 0, overflow: "hidden" }}>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-xl p-4 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 mb-1">Watchlist Size</p>
                    <p className="text-2xl font-bold text-white">{watchlistData.coins.length}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl p-4 border border-green-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 mb-1">
                      {isRaceMode ? "Race Started" : "Tracking Since"}
                    </p>
                    <p className="text-lg font-bold text-white">
                      {watchlistData.startTime ? new Date(watchlistData.startTime).toLocaleTimeString() : "Not Started"}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-400" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 mb-1">
                      {isRaceMode ? "Race Leader" : "Best Performer"}
                    </p>
                    <p className="text-lg font-bold text-white">{bestPerformer?.symbol || "N/A"}</p>
                    {bestPerformer && (
                      <p className="text-sm text-green-400">
                        {formatPercentage(isRaceMode ? bestPerformer.normalizedPrice : bestPerformer.changesSinceStart)}
                      </p>
                    )}
                  </div>
                  {isRaceMode ? (
                    <Trophy className="h-8 w-8 text-purple-400" />
                  ) : (
                    <TrendingUp className="h-8 w-8 text-purple-400" />
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm rounded-xl p-4 border border-orange-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-400 mb-1">Fastest Mover</p>
                    <p className="text-lg font-bold text-white">{fastestMover?.symbol || "N/A"}</p>
                  </div>
                  <Zap className="h-8 w-8 text-orange-400" />
                </div>
              </div>
            </div>

            {/* Race Leaderboard */}
            {isRaceMode && (
              <div style={{ minHeight: 0, overflow: "auto" }}>
                <RaceLeaderboard coins={sortedCoins} isRaceMode={isRaceMode} />
              </div>
            )}
          </div>

          {/* Main Chart Area */}
          <div
            className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50"
            style={{ minHeight: 0 }}
          >
            <div className="h-full p-6 flex flex-col">
              {isRaceMode ? (
                <>
                  <div className="mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-1">🏁 Momentum Race</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-lg text-white">Normalized Performance Since Start</span>
                      <span className="text-sm text-gray-400">Timeframe: {timeFrame}</span>
                    </div>
                  </div>
                  <div className="flex-1" style={{ minHeight: 0 }}>
                    <RaceChart coins={sortedCoins} startTime={watchlistData.startTime} timeFrame={timeFrame} />
                  </div>
                </>
              ) : selectedCoin && watchlistData.startTime ? (
                <>
                  <div className="mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-1">{selectedCoin.symbol}/USD</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-mono text-white">${formatPrice(selectedCoin.currentPrice)}</span>
                      <span
                        className={`font-semibold ${
                          selectedCoin.changesSinceStart > 0
                            ? "text-green-400"
                            : selectedCoin.changesSinceStart < 0
                              ? "text-red-400"
                              : "text-gray-400"
                        }`}
                      >
                        {formatPercentage(selectedCoin.changesSinceStart)} since start
                      </span>
                    </div>
                  </div>
                  <div className="flex-1" style={{ minHeight: 0 }}>
                    <RaceChart coins={[selectedCoin]} startTime={watchlistData.startTime} timeFrame={timeFrame} />
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2 text-sm">
                      {!watchlistData.startTime
                        ? "Start a race to begin tracking momentum"
                        : "Select a coin from the watchlist to view its chart"}
                    </p>
                    {!watchlistData.startTime && watchlistData.coins.length > 0 && (
                      <button
                        onClick={startRace}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all text-sm font-medium"
                      >
                        Start Race
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Watchlist */}
          <div
            className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 flex flex-col"
            style={{ minHeight: 0 }}
          >
            {/* Table Controls */}
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Momentum Watchlist</h2>
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search coins..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48 pl-10 pr-4 py-2 bg-[#2a2d3a] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-[#2a2d3a] rounded-lg p-1">
                  <button
                    onClick={() => setWatchlistViewMode("table")}
                    className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all font-medium ${
                      watchlistViewMode === "table" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <List className="h-3 w-3" />
                    Table
                  </button>
                  <button
                    onClick={() => setWatchlistViewMode("cards")}
                    className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all font-medium ${
                      watchlistViewMode === "cards" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Grid3X3 className="h-3 w-3" />
                    Cards
                  </button>
                </div>

                {/* Add Coin Button */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add Coin
                </button>
              </div>
            </div>

            <div className="flex-1" style={{ minHeight: 0, overflow: "auto" }}>
              {filteredCoins.length > 0 ? (
                <div className="space-y-2 p-2">
                  {filteredCoins.map((coin, index) => (
                    <div
                      key={coin.id}
                      onClick={() => setSelectedCoin(coin)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-300 ease-out ${
                        selectedCoin?.id === coin.id
                          ? "bg-purple-500/20 border border-purple-500/30"
                          : "hover:bg-gray-800/30"
                      } ${
                        shouldPulse(coin)
                          ? "animate-pulse border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-300"
                            style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                          >
                            {coin.symbol.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate">{coin.symbol}</div>
                            <div className="text-xs text-gray-400 truncate">{coin.name}</div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeCoin(coin.id)
                          }}
                          className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">Price</span>
                          <span className="text-white font-mono text-right">${formatPrice(coin.currentPrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">{isRaceMode ? "Race %" : "Since Start"}</span>
                          <span
                            className={`font-semibold text-right transition-colors duration-300 ${
                              (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) > 0
                                ? "text-green-400"
                                : (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) < 0
                                  ? "text-red-400"
                                  : "text-gray-400"
                            }`}
                          >
                            {watchlistData.startTime
                              ? formatPercentage(isRaceMode ? coin.normalizedPrice : coin.changesSinceStart)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400 font-bold">Rate</span>
                          <span
                            className={`text-xs text-right transition-colors duration-300 ${
                              Math.abs(coin.rateOfChange) > 0.5
                                ? coin.rateOfChange > 0
                                  ? "text-green-400"
                                  : "text-red-400"
                                : "text-gray-400"
                            }`}
                          >
                            {coin.rateOfChange.toFixed(2)}%/min
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center">
                    <Plus className="h-8 w-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Add coins to watchlist</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <AddCoinModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={addCoin}
          existingSymbols={watchlistData.coins.map((c) => c.symbol)}
        />
        <ResetConfirmModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          onConfirm={resetTracking}
        />
      </div>
    )
  }

  return (
    <div
      className="dashboard-container"
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        background: "linear-gradient(135deg, #1a1b23 0%, #1e1f2a 50%, #1a1b23 100%)",
      }}
    >
      {/* Header */}
      <div className="bg-[#21222d]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Momentum Tracker</h1>
                  <p className="text-xs text-gray-400">Real-time leverage trading momentum</p>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isTracking ? "bg-green-400" : "bg-gray-500"}`} />
                <span className="text-sm text-gray-400 font-bold">
                  {isRaceMode ? "Race Active" : isTracking ? "Tracking Active" : "Ready to Track"}
                </span>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-[#2a2d3a] rounded-lg p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all font-medium ${
                    viewMode === "table" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <List className="h-4 w-4" />
                  Table
                </button>
                <button
                  onClick={() => setViewMode("chart")}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all font-medium ${
                    viewMode === "chart" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Chart
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Time Frame Selector */}
              <TimeFrameSelector timeFrame={timeFrame} onTimeFrameChange={setTimeFrame} />

              {/* Live Momentum Toggle */}
              <button
                onClick={() => setLiveMomentumMode(!liveMomentumMode)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  liveMomentumMode
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                    : "bg-[#2a2d3a] border border-gray-700 hover:bg-[#3a3d4a] text-gray-400 hover:text-white"
                }`}
              >
                <Star className="h-4 w-4" />
                Live Momentum
              </button>

              {/* Race Controls */}
              <RaceControls
                isRaceMode={isRaceMode}
                onStartRace={startRace}
                onStopRace={stopRace}
                isTracking={isTracking}
                coinCount={watchlistData.coins.length}
              />

              <button
                onClick={() => setIsResetModalOpen(true)}
                disabled={!isTracking}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2a2d3a] border border-gray-700 hover:bg-[#3a3d4a] disabled:opacity-50 text-white rounded-lg transition-all disabled:cursor-not-allowed text-sm font-medium"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div
        className="dashboard-content"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1rem",
          minHeight: 0,
          padding: "1.5rem",
        }}
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-xl p-3 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">Watchlist Size</p>
                <p className="text-xl font-bold text-white">{watchlistData.coins.length}</p>
              </div>
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl p-3 border border-green-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">{isRaceMode ? "Race Started" : "Tracking Since"}</p>
                <p className="text-sm font-bold text-white">
                  {watchlistData.startTime ? new Date(watchlistData.startTime).toLocaleTimeString() : "Not Started"}
                </p>
                {watchlistData.startTime && (
                  <p className="text-xs text-gray-400">
                    {Math.floor((Date.now() - watchlistData.startTime) / 60000)}m elapsed
                  </p>
                )}
              </div>
              <Clock className="h-6 w-6 text-green-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-3 border border-purple-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">{isRaceMode ? "Race Leader" : "Best Performer"}</p>
                <p className="text-sm font-bold text-white">{bestPerformer?.symbol || "N/A"}</p>
                {bestPerformer && (
                  <p className="text-xs text-green-400">
                    {formatPercentage(isRaceMode ? bestPerformer.normalizedPrice : bestPerformer.changesSinceStart)}
                  </p>
                )}
              </div>
              {isRaceMode ? (
                <Trophy className="h-6 w-6 text-purple-400" />
              ) : (
                <TrendingUp className="h-6 w-6 text-purple-400" />
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm rounded-xl p-3 border border-orange-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 mb-1">Fastest Mover</p>
                <p className="text-sm font-bold text-white">{fastestMover?.symbol || "N/A"}</p>
              </div>
              <Zap className="h-6 w-6 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Race Mode Banner */}
        {isRaceMode && (
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="h-6 w-6 text-green-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">🏁 Race Mode Active</h3>
                  <p className="text-sm text-gray-400">All coins normalized to 0% at race start</p>
                </div>
              </div>
              <button
                onClick={stopRace}
                className="px-4 py-2 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400 hover:text-white rounded-lg transition-all text-sm font-medium"
              >
                Stop Race
              </button>
            </div>
          </div>
        )}

        {/* Watchlist Table */}
        {watchlistData.coins.length > 0 ? (
          <div
            className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 overflow-hidden"
            style={{ minHeight: 0 }}
          >
            {/* Table Controls */}
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Momentum Watchlist</h2>
              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search coins..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48 pl-10 pr-4 py-2 bg-[#2a2d3a] border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-1 bg-[#2a2d3a] rounded-lg p-1">
                  <button
                    onClick={() => setWatchlistViewMode("table")}
                    className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all font-medium ${
                      watchlistViewMode === "table" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <List className="h-3 w-3" />
                    Table
                  </button>
                  <button
                    onClick={() => setWatchlistViewMode("cards")}
                    className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs transition-all font-medium ${
                      watchlistViewMode === "cards" ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <Grid3X3 className="h-3 w-3" />
                    Cards
                  </button>
                </div>

                {/* Add Coin Button */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add Coin
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 400px)" }}>
              {watchlistViewMode === "cards" ? (
                renderCardView()
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1e1f2a]">
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left p-4 text-sm font-bold">
                        <span className="text-gray-400">Asset</span>
                      </th>
                      <th className="text-center p-4 text-sm font-bold">
                        <SortButton field="currentPrice">Current Price</SortButton>
                      </th>
                      <th className="text-center p-4 text-sm font-bold">
                        <SortButton field="changesSinceStart">{isRaceMode ? "Race %" : "% Since Start"}</SortButton>
                      </th>
                      <th className="text-center p-4 text-sm font-bold">
                        <SortButton field="rateOfChange">Rate of Change</SortButton>
                      </th>
                      <th className="text-center p-4 text-sm font-bold">
                        <SortButton field="dailyChange">Daily %</SortButton>
                      </th>
                      <th className="text-center p-4 text-sm font-bold text-gray-400">Momentum</th>
                      <th className="text-center p-4 text-sm font-bold text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoins.map((coin, index) => (
                      <tr
                        key={coin.id}
                        className={`border-b border-gray-700/30 hover:bg-gray-800/20 transition-all duration-300 ease-out ${
                          shouldPulse(coin) ? "animate-pulse bg-yellow-500/5 border-l-4 border-l-yellow-500/50" : ""
                        } ${
                          isRaceMode && coin.racePosition === 1 ? "bg-yellow-500/10 border-l-4 border-l-yellow-500" : ""
                        }`}
                        style={{
                          transform:
                            coin.previousPosition && coin.previousPosition !== coin.racePosition
                              ? `translateY(${(coin.previousPosition - coin.racePosition) * 5}px)`
                              : "translateY(0)",
                          transition: "transform 0.5s ease-out, background-color 0.3s ease-out",
                        }}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold transition-all duration-300"
                                style={{ backgroundColor: COIN_COLORS[index % COIN_COLORS.length] }}
                              >
                                {coin.symbol.charAt(0)}
                              </div>
                              {isRaceMode && coin.racePosition <= 3 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-xs font-bold text-black transition-all duration-300">
                                  {coin.racePosition}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-white text-sm truncate">{coin.symbol}</div>
                              <div className="text-xs text-gray-400 truncate">{coin.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="text-white font-mono text-lg">${formatPrice(coin.currentPrice)}</div>
                        </td>
                        <td className="p-4 text-center">
                          <div
                            className={`font-bold text-lg transition-colors duration-300 ${
                              (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) > 0
                                ? "text-green-400"
                                : (isRaceMode ? coin.normalizedPrice : coin.changesSinceStart) < 0
                                  ? "text-red-400"
                                  : "text-gray-400"
                            }`}
                          >
                            {watchlistData.startTime
                              ? formatPercentage(isRaceMode ? coin.normalizedPrice : coin.changesSinceStart)
                              : "—"}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {Math.abs(coin.rateOfChange) > 0.1 && (
                              <>
                                {coin.rateOfChange > 0 ? (
                                  <TrendingUp className="h-3 w-3 text-green-400" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-red-400" />
                                )}
                              </>
                            )}
                            <span
                              className={`text-sm font-semibold transition-colors duration-300 ${
                                Math.abs(coin.rateOfChange) > 0.5
                                  ? coin.rateOfChange > 0
                                    ? "text-green-400"
                                    : "text-red-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {coin.rateOfChange.toFixed(2)}%/min
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`text-sm font-semibold transition-colors duration-300 ${
                              coin.dailyChange > 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {formatPercentage(coin.dailyChange)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <MiniSparkline
                            data={coin.priceHistory.slice(-20).map((p) => p.price)}
                            isPositive={coin.changesSinceStart > 0}
                          />
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeCoin(coin.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-[#1e1f2a] to-[#252631] rounded-xl border border-gray-700/50 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Start Building Your Watchlist</h3>
            <p className="text-gray-400 mb-6 text-sm">Add coins to track their momentum from a specific start time</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all text-sm font-medium"
            >
              Add Your First Coin
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddCoinModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={addCoin}
        existingSymbols={watchlistData.coins.map((c) => c.symbol)}
      />
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={resetTracking}
      />
    </div>
  )
}
