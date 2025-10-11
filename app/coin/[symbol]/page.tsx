"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react"
import { useCoinbase } from "@/hooks/use-coinbase"
import { calculateMomentum, getTimeframeMs, type MomentumTimeframe, type PricePoint } from "@/lib/momentum-calculator"

const COIN_DATA: Record<string, { symbol: string; name: string; coinbaseId: string }> = {
  btc: { symbol: "BTC-USD", name: "Bitcoin", coinbaseId: "BTC-USD" },
  eth: { symbol: "ETH-USD", name: "Ethereum", coinbaseId: "ETH-USD" },
  sol: { symbol: "SOL-USD", name: "Solana", coinbaseId: "SOL-USD" },
  ada: { symbol: "ADA-USD", name: "Cardano", coinbaseId: "ADA-USD" },
  doge: { symbol: "DOGE-USD", name: "Dogecoin", coinbaseId: "DOGE-USD" },
  avax: { symbol: "AVAX-USD", name: "Avalanche", coinbaseId: "AVAX-USD" },
  uni: { symbol: "UNI-USD", name: "Uniswap", coinbaseId: "UNI-USD" },
  link: { symbol: "LINK-USD", name: "Chainlink", coinbaseId: "LINK-USD" },
}

const TIMEFRAMES: MomentumTimeframe[] = ["30s", "1m", "2m", "5m"]

const formatPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`

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

    const padding = { top: 40, right: 60, bottom: 40, left: 60 }
    const chartWidth = rect.width - padding.left - padding.right
    const chartHeight = rect.height - padding.top - padding.bottom

    const prices = priceHistory.map((p) => p.price)
    const timestamps = priceHistory.map((p) => p.timestamp)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice || 1

    // Grid and axes
    ctx.strokeStyle = "#3C4043"
    ctx.lineWidth = 1

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartHeight
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartWidth, y)
      ctx.stroke()

      // Price labels
      const priceValue = maxPrice - (i / 5) * priceRange
      ctx.fillStyle = "#9AA0A6"
      ctx.font = "11px system-ui"
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      ctx.fillText(`$${formatPrice(priceValue)}`, padding.left - 8, y)
    }

    // Vertical grid lines
    const timeSteps = 5
    for (let i = 0; i <= timeSteps; i++) {
      const x = padding.left + (i / timeSteps) * chartWidth
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + chartHeight)
      ctx.stroke()

      // Time labels
      if (i < timestamps.length) {
        const timeIndex = Math.floor((i / timeSteps) * (timestamps.length - 1))
        const time = new Date(timestamps[timeIndex])
        const timeLabel = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        ctx.fillStyle = "#9AA0A6"
        ctx.font = "11px system-ui"
        ctx.textAlign = "center"
        ctx.textBaseline = "top"
        ctx.fillText(timeLabel, x, padding.top + chartHeight + 8)
      }
    }

    ctx.setLineDash([])

    // Draw price line
    ctx.beginPath()
    ctx.strokeStyle = "#00E5FF"
    ctx.lineWidth = 2.5
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

    // Add glow effect
    ctx.shadowColor = "#00E5FF"
    ctx.shadowBlur = 8
    ctx.stroke()
    ctx.shadowBlur = 0

    // Draw gradient fill under line
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
    gradient.addColorStop(0, "rgba(0, 229, 255, 0.2)")
    gradient.addColorStop(1, "rgba(0, 229, 255, 0.0)")
    ctx.fillStyle = gradient
    ctx.fill()

    // Draw current price dot
    if (priceHistory.length > 0) {
      const lastPoint = priceHistory[priceHistory.length - 1]
      const x = padding.left + chartWidth
      const y = padding.top + ((maxPrice - lastPoint.price) / priceRange) * chartHeight

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fillStyle = "#00E5FF"
      ctx.fill()
      ctx.strokeStyle = "#121212"
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }, [priceHistory, coinName])

  if (priceHistory.length < 2) {
    return (
      <div className="h-full flex items-center justify-center text-[#9AA0A6]">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">Loading price data...</p>
        </div>
      </div>
    )
  }

  return <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
}

export default function CoinPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string

  const coinInfo = COIN_DATA[symbol.toLowerCase()]
  const { book } = useCoinbase(coinInfo ? [coinInfo.coinbaseId] : [])

  const [selectedTimeframe, setSelectedTimeframe] = useState<MomentumTimeframe>("1m")
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [momentum, setMomentum] = useState(0)

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

    const timeframeMs = getTimeframeMs(selectedTimeframe)
    const calculatedMomentum = calculateMomentum(history, timeframeMs)
    setMomentum(calculatedMomentum)
  }, [book, coinInfo, selectedTimeframe])

  if (!coinInfo) {
    return (
      <div className="flex flex-col h-screen bg-[#121212] text-[#E3E3E3]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Coin Not Found</h1>
            <p className="text-[#9AA0A6] mb-6">The coin "{symbol}" is not available.</p>
            <Button
              onClick={() => router.push("/")}
              className="bg-[#A8C7FA] hover:bg-[#8AB4F8] text-[#121212] px-6 py-2 rounded-lg font-medium"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const priceChange = priceHistory.length >= 2 ? currentPrice - priceHistory[0].price : 0
  const priceChangePercent = priceHistory.length >= 2 ? (priceChange / priceHistory[0].price) * 100 : 0

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-[#E3E3E3] overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[#3C4043] bg-[#1E1E1E]/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-[#292A2D] rounded-lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 md:size-14 rounded-full bg-gradient-to-br from-[#A8C7FA] to-[#00E5FF] text-[#121212] text-xl md:text-2xl font-bold grid place-items-center flex-shrink-0">
                {coinInfo.symbol.split("-")[0].charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{coinInfo.name}</h1>
                <p className="text-[#9AA0A6] text-sm md:text-base">{coinInfo.symbol.split("-")[0]}</p>
              </div>
              {priceHistory.length >= 2 && (
                <Badge
                  className={`${priceChangePercent >= 0 ? "bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/30" : "bg-[#FF4D6D]/20 text-[#FF4D6D] border-[#FF4D6D]/30"}`}
                >
                  {priceChangePercent >= 0 ? "+" : ""}
                  {priceChangePercent.toFixed(2)}% Session
                </Badge>
              )}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 bg-[#1E1E1E] rounded-lg p-1 border border-[#3C4043]">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-md text-xs md:text-sm transition-all font-medium ${
                    selectedTimeframe === tf
                      ? "bg-[#A8C7FA] text-[#121212] shadow-lg"
                      : "text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-[#292A2D]"
                  }`}
                  aria-label={`Set timeframe to ${tf}`}
                  aria-pressed={selectedTimeframe === tf}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-[#A8C7FA]" />
                  <CardTitle className="text-sm font-medium text-[#9AA0A6]">Current Price</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl md:text-3xl font-bold text-[#E3E3E3] font-mono">
                  ${currentPrice ? formatPrice(currentPrice) : "Loading..."}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-[#00E5FF]" />
                  <CardTitle className="text-sm font-medium text-[#9AA0A6]">Session Change</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${
                    priceChangePercent >= 0 ? "text-[#00E5FF]" : "text-[#FF4D6D]"
                  }`}
                >
                  {priceChangePercent !== 0 &&
                    (priceChangePercent > 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    ))}
                  {priceHistory.length >= 2 ? formatPercentage(priceChangePercent) : "—"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-5 w-5 text-[#FFAE2B]" />
                  <CardTitle className="text-sm font-medium text-[#9AA0A6]">Momentum ({selectedTimeframe})</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className={`text-2xl md:text-3xl font-bold ${
                    Math.abs(momentum) > 0.5 ? (momentum > 0 ? "text-[#00E5FF]" : "text-[#FF4D6D]") : "text-[#9AA0A6]"
                  }`}
                >
                  {formatPercentage(momentum)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-5 w-5 text-[#9C6BFF]" />
                  <CardTitle className="text-sm font-medium text-[#9AA0A6]">Price Change</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className={`text-2xl md:text-3xl font-bold ${priceChange >= 0 ? "text-[#00E5FF]" : "text-[#FF4D6D]"}`}
                >
                  {priceHistory.length >= 2 ? `$${formatPrice(Math.abs(priceChange))}` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="bg-[#1E1E1E] border-[#3C4043] rounded-lg shadow-xl overflow-hidden">
            <CardHeader className="border-b border-[#3C4043]">
              <CardTitle className="text-lg text-[#E3E3E3]">Price Chart</CardTitle>
              <p className="text-sm text-[#9AA0A6]">Real-time price movements and momentum analysis</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[400px] md:h-[500px] p-4">
                <CoinChart priceHistory={priceHistory} coinName={coinInfo.name} />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
