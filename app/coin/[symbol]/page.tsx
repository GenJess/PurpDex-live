"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, BarChart3, Wifi, WifiOff } from "lucide-react"
import { useCoinbase } from "@/hooks/use-coinbase"
import { useCoinbaseProducts } from "@/hooks/use-coinbase-products"
import { calculateMomentum, getTimeframeMs, type MomentumTimeframe, type PricePoint } from "@/lib/momentum-calculator"

const TIMEFRAMES: MomentumTimeframe[] = ["30s", "1m", "2m", "5m"]

const LOGO_SLUGS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  ADA: "cardano", AVAX: "avalanche-2", LINK: "chainlink", UNI: "uniswap",
  DOT: "polkadot", MATIC: "matic-network", SHIB: "shiba-inu", XRP: "ripple",
  LTC: "litecoin", ATOM: "cosmos", NEAR: "near", APT: "aptos",
  ARB: "arbitrum", OP: "optimism", FIL: "filecoin", AAVE: "aave",
}

const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", DOGE: "#C2A633",
  ADA: "#0033AD", AVAX: "#E84142", LINK: "#2A5ADA", UNI: "#FF007A",
}

function CoinLogo({ symbol, size = 48 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const color = COIN_COLORS[symbol] || "#00E5A0"

  if (failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-black font-bold font-mono flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.32 }}
      >
        {symbol.slice(0, 2)}
      </div>
    )
  }

  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/nicehash/Cryptocurrency-Images/main/${symbol.toLowerCase()}.png`}
      alt={symbol}
      width={size}
      height={size}
      className="rounded-full flex-shrink-0"
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
    />
  )
}

const fmtPrice = (p: number) => {
  if (!p || !Number.isFinite(p)) return "..."
  if (p < 0.001) return p.toFixed(6)
  if (p < 1) return p.toFixed(4)
  if (p < 100) return p.toFixed(2)
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtPct = (v: number) => {
  if (!Number.isFinite(v)) return "..."
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}

function PriceChart({ priceHistory }: { priceHistory: PricePoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || priceHistory.length < 2) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const pad = { top: 24, right: 56, bottom: 24, left: 56 }
    const w = rect.width - pad.left - pad.right
    const h = rect.height - pad.top - pad.bottom

    const prices = priceHistory.map((p) => p.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1

    const isUp = prices[prices.length - 1] >= prices[0]
    const lineColor = isUp ? "hsl(160, 100%, 50%)" : "hsl(0, 72%, 58%)"

    // Grid
    ctx.strokeStyle = "hsl(220, 14%, 10%)"
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * h
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(pad.left + w, y)
      ctx.stroke()

      ctx.fillStyle = "hsl(220, 10%, 35%)"
      ctx.font = "10px monospace"
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      const pVal = max - (i / 4) * range
      ctx.fillText(`$${fmtPrice(pVal)}`, pad.left - 8, y)
    }
    ctx.setLineDash([])

    // Price line
    ctx.beginPath()
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    priceHistory.forEach((pt, i) => {
      const x = pad.left + (i / (priceHistory.length - 1)) * w
      const y = pad.top + ((max - pt.price) / range) * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Gradient fill
    ctx.beginPath()
    ctx.moveTo(pad.left, pad.top + h)
    priceHistory.forEach((pt, i) => {
      const x = pad.left + (i / (priceHistory.length - 1)) * w
      const y = pad.top + ((max - pt.price) / range) * h
      ctx.lineTo(x, y)
    })
    ctx.lineTo(pad.left + w, pad.top + h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h)
    if (isUp) {
      grad.addColorStop(0, "hsla(160, 100%, 50%, 0.12)")
      grad.addColorStop(1, "hsla(160, 100%, 50%, 0)")
    } else {
      grad.addColorStop(0, "hsla(0, 72%, 58%, 0.12)")
      grad.addColorStop(1, "hsla(0, 72%, 58%, 0)")
    }
    ctx.fillStyle = grad
    ctx.fill()

    // End dot
    const last = priceHistory[priceHistory.length - 1]
    const ex = pad.left + w
    const ey = pad.top + ((max - last.price) / range) * h
    ctx.beginPath()
    ctx.arc(ex, ey, 4, 0, 2 * Math.PI)
    ctx.fillStyle = lineColor
    ctx.fill()
  }, [priceHistory])

  if (priceHistory.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 text-[hsl(220,10%,25%)]" />
          <p className="text-sm text-[hsl(220,10%,40%)]">Waiting for price data...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
    </div>
  )
}

export default function CoinPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = (params.symbol as string).toUpperCase()

  const { products, loading: productsLoading } = useCoinbaseProducts()
  const coinInfo = useMemo(() => {
    const pid = `${symbol}-USD`
    const p = products.find((pr) => pr.product_id === pid)
    return p ? { symbol: p.product_id, name: p.base_name, coinbaseId: p.product_id } : null
  }, [products, symbol])

  const { book, status } = useCoinbase(coinInfo ? [coinInfo.coinbaseId] : [])

  const [selectedTf, setSelectedTf] = useState<MomentumTimeframe>("1m")
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [momentum, setMomentum] = useState(0)
  const [startPrice, setStartPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!coinInfo || !book[coinInfo.coinbaseId]) return
    const series = book[coinInfo.coinbaseId]
    if (series.length === 0) return

    const latest = series[series.length - 1]
    const hist: PricePoint[] = series.slice(-200).map((p) => ({ price: p.price, timestamp: p.ts }))

    setCurrentPrice(latest.price)
    setPriceHistory(hist)
    if (startPrice === null && latest.price > 0) setStartPrice(latest.price)

    setMomentum(calculateMomentum(hist, getTimeframeMs(selectedTf)))
  }, [book, coinInfo, selectedTf, startPrice])

  if (productsLoading) {
    return (
      <div className="min-h-[100dvh] bg-[hsl(220,16%,4%)] text-[hsl(220,15%,88%)] flex items-center justify-center">
        <Activity className="w-8 h-8 text-[hsl(var(--primary))] animate-pulse" />
      </div>
    )
  }

  if (!coinInfo) {
    return (
      <div className="min-h-[100dvh] bg-[hsl(220,16%,4%)] text-[hsl(220,15%,88%)] flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Not Found</h1>
          <p className="text-sm text-[hsl(220,10%,45%)] mb-5">{`"${symbol}" is not available on Coinbase.`}</p>
          <Button onClick={() => router.push("/")} className="bg-[hsl(var(--primary))] text-black font-mono rounded-lg press-scale">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      </div>
    )
  }

  const change = startPrice && currentPrice ? ((currentPrice - startPrice) / startPrice) * 100 : 0
  const isUp = change >= 0

  return (
    <div className="min-h-[100dvh] bg-[hsl(220,16%,4%)] text-[hsl(220,15%,88%)] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[hsl(220,14%,10%)] bg-[hsl(220,16%,5%)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost" onClick={() => router.push("/")}
              className="text-[hsl(220,10%,50%)] hover:text-[hsl(220,15%,85%)] hover:bg-[hsl(220,14%,10%)] font-mono rounded-lg press-scale h-8 px-2"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
            </Button>
            <div className="flex items-center gap-1.5">
              {status === "connected" ? (
                <><span className="live-dot w-1.5 h-1.5 rounded-full bg-[hsl(var(--gain))]" /><span className="text-[10px] text-[hsl(var(--gain))] font-mono">LIVE</span></>
              ) : (
                <><WifiOff className="w-3.5 h-3.5 text-[hsl(220,10%,35%)]" /><span className="text-[10px] text-[hsl(220,10%,35%)] font-mono">CONNECTING</span></>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <CoinLogo symbol={symbol} size={44} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{coinInfo.name}</h1>
                <span className="text-sm font-mono text-[hsl(220,10%,45%)]">{symbol}</span>
              </div>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span className="text-2xl font-bold font-mono">${currentPrice ? fmtPrice(currentPrice) : "..."}</span>
                {startPrice && (
                  <span className={`text-sm font-mono font-medium flex items-center gap-1 ${isUp ? "text-gain" : "text-loss"}`}>
                    {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {fmtPct(change)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="border-b border-[hsl(220,14%,10%)] bg-[hsl(220,16%,5%)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Session", value: startPrice ? fmtPct(change) : "...", color: isUp },
              { label: `Momentum (${selectedTf})`, value: fmtPct(momentum), color: momentum >= 0 },
              { label: "Data Points", value: String(priceHistory.length), color: null },
            ].map((s) => (
              <div key={s.label} className="card-surface p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,38%)] mb-1">{s.label}</div>
                <div className={`text-lg font-bold font-mono ${s.color === true ? "text-gain" : s.color === false ? "text-loss" : "text-[hsl(220,15%,85%)]"}`}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex items-center justify-center mt-3">
            <div className="flex items-center gap-0.5 bg-[hsl(220,14%,7%)] rounded-lg p-0.5 border border-[hsl(220,14%,12%)]">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTf(tf)}
                  className={`px-3 py-1 rounded-md text-[11px] font-mono transition-all press-scale ${
                    selectedTf === tf
                      ? "bg-[hsl(var(--primary))] text-black font-semibold"
                      : "text-[hsl(220,10%,50%)] hover:text-[hsl(220,15%,80%)]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 py-4 h-full">
          <div className="card-surface h-full min-h-[280px] sm:min-h-[360px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[hsl(220,14%,10%)]">
              <h2 className="text-sm font-semibold text-[hsl(220,15%,85%)]">Price</h2>
              <p className="text-[11px] text-[hsl(220,10%,38%)]">Real-time from Coinbase</p>
            </div>
            <div className="p-3 h-[calc(100%-56px)]">
              <PriceChart priceHistory={priceHistory} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
