"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, BarChart3, Wifi, WifiOff } from "lucide-react"
import { useCoinbase } from "@/hooks/use-coinbase"
import { useCoinbaseProducts } from "@/hooks/use-coinbase-products"
import { calculateMomentum, getTimeframeMs, type MomentumTimeframe, type PricePoint } from "@/lib/momentum-calculator"

const TIMEFRAMES: MomentumTimeframe[] = ["30s", "1m", "2m", "5m"]

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

function CoinChart({ priceHistory, coinName }: { priceHistory: PricePoint[]; coinName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || priceHistory.length < 2) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const padding = { top: 30, right: 50, bottom: 30, left: 60 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    const prices = priceHistory.map((p) => p.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice || 1

    // Grid lines
    ctx.strokeStyle = "hsl(210, 15%, 15%)"
    ctx.lineWidth = 1

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * chartHeight
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartWidth, y)
      ctx.stroke()

      // Price labels
      const priceValue = maxPrice - (i / 4) * priceRange
      ctx.fillStyle = "hsl(210, 10%, 55%)"
      ctx.font = "11px monospace"
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      ctx.fillText(`$${formatPrice(priceValue)}`, padding.left - 8, y)
    }

    ctx.setLineDash([])

    // Draw price line - cyan color
    ctx.beginPath()
    ctx.strokeStyle = "hsl(185, 100%, 50%)"
    ctx.lineWidth = 2
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    priceHistory.forEach((point, i) => {
      const x = padding.left + (i / (priceHistory.length - 1)) * chartWidth
      const y = padding.top + ((maxPrice - point.price) / priceRange) * chartHeight

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Gradient fill
    ctx.beginPath()
    ctx.moveTo(padding.left, padding.top + chartHeight)
    priceHistory.forEach((point, i) => {
      const x = padding.left + (i / (priceHistory.length - 1)) * chartWidth
      const y = padding.top + ((maxPrice - point.price) / priceRange) * chartHeight
      ctx.lineTo(x, y)
    })
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight)
    gradient.addColorStop(0, "hsla(185, 100%, 50%, 0.15)")
    gradient.addColorStop(1, "hsla(185, 100%, 50%, 0)")
    ctx.fillStyle = gradient
    ctx.fill()

    // Current price dot
    if (priceHistory.length > 0) {
      const lastPoint = priceHistory[priceHistory.length - 1]
      const x = padding.left + chartWidth
      const y = padding.top + ((maxPrice - lastPoint.price) / priceRange) * chartHeight

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = "hsl(185, 100%, 50%)"
      ctx.fill()
    }
  }, [priceHistory, coinName])

  if (priceHistory.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-[hsl(210,10%,55%)]">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Waiting for price data...</p>
        </div>
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
}

export default function CoinPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = (params.symbol as string).toUpperCase()

  const { products, loading: productsLoading } = useCoinbaseProducts()
  const coinInfo = useMemo(() => {
    const productId = `${symbol}-USD`
    const product = products.find((p) => p.product_id === productId)
    if (product) {
      return {
        symbol: product.product_id,
        name: product.base_name,
        coinbaseId: product.product_id,
      }
    }
    return null
  }, [products, symbol])

  const { book, status, error } = useCoinbase(coinInfo ? [coinInfo.coinbaseId] : [])

  const [selectedTimeframe, setSelectedTimeframe] = useState<MomentumTimeframe>("1m")
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [momentum, setMomentum] = useState(0)
  const [startPrice, setStartPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!coinInfo || !book[coinInfo.coinbaseId]) return

    const series = book[coinInfo.coinbaseId]
    if (series.length === 0) return

    const latest = series[series.length - 1]
    const history: PricePoint[] = series.slice(-200).map((p) => ({
      price: p.price,
      timestamp: p.ts,
    }))

    setCurrentPrice(latest.price)
    setPriceHistory(history)

    // Set start price on first data
    if (startPrice === null && latest.price > 0) {
      setStartPrice(latest.price)
    }

    const timeframeMs = getTimeframeMs(selectedTimeframe)
    const calculatedMomentum = calculateMomentum(history, timeframeMs)
    setMomentum(calculatedMomentum)
  }, [book, coinInfo, selectedTimeframe, startPrice])

  // Loading state
  if (productsLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,0%)] text-[hsl(210,20%,90%)] flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 mx-auto mb-4 text-[hsl(185,100%,50%)] animate-pulse" />
          <p className="text-[hsl(210,10%,55%)]">Loading...</p>
        </div>
      </div>
    )
  }

  // Coin not found
  if (!coinInfo) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,0%)] text-[hsl(210,20%,90%)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Coin Not Found</h1>
          <p className="text-[hsl(210,10%,55%)] mb-6">The coin "{symbol}" is not available on Coinbase.</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-[hsl(185,100%,50%)] hover:bg-[hsl(185,100%,45%)] text-black font-mono"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const sessionChange = startPrice && currentPrice ? ((currentPrice - startPrice) / startPrice) * 100 : 0

  return (
    <div className="min-h-screen bg-[hsl(0,0%,0%)] text-[hsl(210,20%,90%)] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[hsl(210,15%,18%)] bg-[hsl(210,15%,6%)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-[hsl(210,10%,55%)] hover:text-[hsl(210,20%,90%)] hover:bg-[hsl(210,15%,12%)] font-mono"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {status === "connected" ? (
                <Wifi className="w-4 h-4 text-[hsl(185,100%,50%)]" />
              ) : (
                <WifiOff className="w-4 h-4 text-[hsl(210,10%,55%)]" />
              )}
              <span className="text-xs text-[hsl(210,10%,55%)] font-mono">
                {status === "connected" ? "LIVE" : "CONNECTING"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-[hsl(185,100%,50%)] text-black text-xl font-bold font-mono flex items-center justify-center">
                {symbol.slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{coinInfo.name}</h1>
                <p className="text-[hsl(210,10%,55%)] font-mono">{symbol}</p>
              </div>
              {startPrice && (
                <Badge
                  className={`${sessionChange >= 0 ? "bg-[hsl(145,80%,45%)]/20 text-[hsl(145,80%,45%)]" : "bg-[hsl(0,75%,55%)]/20 text-[hsl(0,75%,55%)]"}`}
                >
                  {formatPercentage(sessionChange)} session
                </Badge>
              )}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-0.5 bg-[hsl(210,15%,8%)] rounded p-0.5 border border-[hsl(210,15%,18%)]">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                    selectedTimeframe === tf
                      ? "bg-[hsl(185,100%,50%)] text-black"
                      : "text-[hsl(210,10%,55%)] hover:text-[hsl(210,20%,90%)] hover:bg-[hsl(210,15%,12%)]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="border-b border-[hsl(210,15%,18%)] bg-[hsl(210,15%,6%)]">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="terminal-card p-4">
              <div className="text-xs text-[hsl(210,10%,55%)] uppercase tracking-wide mb-1">Price</div>
              <div className="text-2xl font-bold font-mono text-[hsl(210,20%,90%)]">
                ${currentPrice ? formatPrice(currentPrice) : "—"}
              </div>
            </div>

            <div className="terminal-card p-4">
              <div className="text-xs text-[hsl(210,10%,55%)] uppercase tracking-wide mb-1">Session Change</div>
              <div
                className={`text-2xl font-bold font-mono flex items-center gap-2 ${sessionChange >= 0 ? "text-[hsl(145,80%,45%)]" : "text-[hsl(0,75%,55%)]"}`}
              >
                {sessionChange !== 0 &&
                  (sessionChange > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />)}
                {startPrice ? formatPercentage(sessionChange) : "—"}
              </div>
            </div>

            <div className="terminal-card p-4">
              <div className="text-xs text-[hsl(210,10%,55%)] uppercase tracking-wide mb-1">
                Momentum ({selectedTimeframe})
              </div>
              <div
                className={`text-2xl font-bold font-mono ${momentum >= 0 ? "text-[hsl(145,80%,45%)]" : "text-[hsl(0,75%,55%)]"}`}
              >
                {formatPercentage(momentum)}
              </div>
            </div>

            <div className="terminal-card p-4">
              <div className="text-xs text-[hsl(210,10%,55%)] uppercase tracking-wide mb-1">Data Points</div>
              <div className="text-2xl font-bold font-mono text-[hsl(210,20%,90%)]">{priceHistory.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 py-4 h-full">
          <div className="terminal-card h-full min-h-[300px] sm:min-h-[400px]">
            <div className="p-4 border-b border-[hsl(210,15%,18%)]">
              <h2 className="text-lg font-semibold text-[hsl(210,20%,90%)]">Price Chart</h2>
              <p className="text-xs text-[hsl(210,10%,55%)]">Real-time price from Coinbase</p>
            </div>
            <div className="p-4 h-[calc(100%-80px)]">
              <CoinChart priceHistory={priceHistory} coinName={coinInfo.name} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
