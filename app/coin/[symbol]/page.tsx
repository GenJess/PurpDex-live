"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from "lucide-react"
import { useCoinbase } from "@/hooks/use-coinbase"

// Real crypto data mapping
const COIN_DATA = {
  btc: { symbol: "BTC-USD", name: "Bitcoin", coinbaseId: "BTC-USD" },
  eth: { symbol: "ETH-USD", name: "Ethereum", coinbaseId: "ETH-USD" },
  sol: { symbol: "SOL-USD", name: "Solana", coinbaseId: "SOL-USD" },
  ada: { symbol: "ADA-USD", name: "Cardano", coinbaseId: "ADA-USD" },
  doge: { symbol: "DOGE-USD", name: "Dogecoin", coinbaseId: "DOGE-USD" },
  avax: { symbol: "AVAX-USD", name: "Avalanche", coinbaseId: "AVAX-USD" },
  uni: { symbol: "UNI-USD", name: "Uniswap", coinbaseId: "UNI-USD" },
  link: { symbol: "LINK-USD", name: "Chainlink", coinbaseId: "LINK-USD" },
}

const formatPrice = (price: number): string => {
  if (price < 0.001) return price.toFixed(8)
  if (price < 1) return price.toFixed(4)
  if (price < 100) return price.toFixed(2)
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatPercentage = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`

export default function CoinPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string

  const coinInfo = COIN_DATA[symbol.toLowerCase() as keyof typeof COIN_DATA]
  const { book } = useCoinbase(coinInfo ? [coinInfo.coinbaseId] : [])

  const [coinData, setCoinData] = useState<{
    currentPrice: number
    dailyChange: number
    volume: number
    addedToWatchlistAt?: number
    changesSinceAdded?: number
  } | null>(null)

  useEffect(() => {
    if (!coinInfo || !book[coinInfo.coinbaseId]) return

    const series = book[coinInfo.coinbaseId]
    if (series.length === 0) return

    const latest = series[series.length - 1]
    const dayAgo = series.find((p) => Date.now() - p.timestamp > 24 * 60 * 60 * 1000)
    const dailyChange = dayAgo ? ((latest.price - dayAgo.price) / dayAgo.price) * 100 : 0

    // Mock volume data - in real app this would come from API
    const volume = Math.random() * 1000000000

    setCoinData({
      currentPrice: latest.price,
      dailyChange,
      volume,
      // These would come from watchlist data in real app
      addedToWatchlistAt: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
      changesSinceAdded: (Math.random() - 0.5) * 20,
    })
  }, [book, coinInfo])

  if (!coinInfo) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Coin Not Found</h1>
          <p className="text-[var(--text-muted)] mb-6">The coin "{symbol}" is not available.</p>
          <Button onClick={() => router.push("/")} className="neon-button">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              className="text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-gradient-to-br from-[var(--orchid)] to-[var(--ice)] text-white text-xl font-bold grid place-items-center">
              {coinInfo.symbol.split("-")[0].charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{coinInfo.name}</h1>
              <p className="text-[var(--text-muted)]">{coinInfo.symbol.split("-")[0]}</p>
            </div>
            {coinData && (
              <Badge className={coinData.dailyChange >= 0 ? "status-active" : "status-hot"}>
                {coinData.dailyChange >= 0 ? "+" : ""}
                {coinData.dailyChange.toFixed(2)}% 24h
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="neon-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-[var(--orchid)]" />
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Current Price</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)] font-mono">
                ${coinData ? formatPrice(coinData.currentPrice) : "Loading..."}
              </div>
            </CardContent>
          </Card>

          <Card className="neon-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-[var(--mint)]" />
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">24h Change</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-2xl font-bold flex items-center gap-2 ${
                  coinData && coinData.dailyChange >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {coinData &&
                  coinData.dailyChange !== 0 &&
                  (coinData.dailyChange > 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  ))}
                {coinData ? formatPercentage(coinData.dailyChange) : "Loading..."}
              </div>
            </CardContent>
          </Card>

          <Card className="neon-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-[var(--ice)]" />
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Since Added</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div
                className={`text-2xl font-bold ${
                  coinData && coinData.changesSinceAdded && coinData.changesSinceAdded >= 0
                    ? "text-positive"
                    : "text-negative"
                }`}
              >
                {coinData && coinData.changesSinceAdded ? formatPercentage(coinData.changesSinceAdded) : "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card className="neon-card">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-[var(--amber)]" />
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Volume (24h)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-[var(--text)]">
                {coinData ? `$${(coinData.volume / 1000000).toFixed(1)}M` : "Loading..."}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart Placeholder */}
        <Card className="neon-card">
          <CardHeader>
            <CardTitle>Price Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 bg-[var(--surface-2)] rounded-lg flex items-center justify-center">
              <div className="text-center text-[var(--text-muted)]">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Chart visualization coming soon</p>
                <p className="text-sm mt-2">Real-time price data and historical performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
