"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCoinbase, type ConnectionStatus } from "@/hooks/use-coinbase"
import { useCoinbaseProducts, type CoinbaseProduct } from "@/hooks/use-coinbase-products"
import {
  Search, Plus, X, RotateCcw, Flag, Pause, Activity, Wifi, WifiOff,
  TrendingUp, ChevronUp, ChevronDown, Minus,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  calculateMomentum, getTimeframeMs, getOptimalBufferSize,
  type MomentumTimeframe, type PricePoint,
} from "@/lib/momentum-calculator"

// ------- Types -------
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
  prevRank: number
  rankDelta: number
  rankFlash: "up" | "down" | null
}

type SortField = "sessionROC" | "momentum" | "currentPrice"

const COIN_COLORS: Record<string, string> = {
  BTC: "#F7931A", ETH: "#627EEA", SOL: "#9945FF", DOGE: "#C2A633",
  ADA: "#0033AD", AVAX: "#E84142", LINK: "#2A5ADA", UNI: "#FF007A",
  DOT: "#E6007A", MATIC: "#8247E5", SHIB: "#FFA409", XRP: "#00AAE4",
  LTC: "#BFBBBB", ATOM: "#2E3148", NEAR: "#00C1DE", APT: "#00BFA5",
}
const DEFAULT_COLOR = "#00E5A0"
const getCoinColor = (symbol: string) => COIN_COLORS[symbol] || DEFAULT_COLOR

const OPTIMAL_BUFFER_SIZE = getOptimalBufferSize()

// ------- Coin Logo (real images from CoinGecko CDN) -------
const LOGO_SLUGS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", DOGE: "dogecoin",
  ADA: "cardano", AVAX: "avalanche-2", LINK: "chainlink", UNI: "uniswap",
  DOT: "polkadot", MATIC: "matic-network", SHIB: "shiba-inu", XRP: "ripple",
  LTC: "litecoin", ATOM: "cosmos", NEAR: "near", APT: "aptos",
  ARB: "arbitrum", OP: "optimism", FIL: "filecoin", AAVE: "aave",
  MKR: "maker", CRV: "curve-dao-token", LDO: "lido-dao", RENDER: "render-token",
  FET: "fetch-ai", GRT: "the-graph", INJ: "injective-protocol", SUI: "sui",
  PEPE: "pepe", WIF: "dogwifcoin", BONK: "bonk",
}

function CoinLogo({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const slug = LOGO_SLUGS[symbol]
  const src = slug ? `https://assets.coingecko.com/coins/images/${slug}/small/${slug}.png` : null

  // Use the simpler thumb API that works without slug mapping
  const fallbackSrc = `https://assets.coingecko.com/coins/images/1/thumb/${symbol.toLowerCase()}.png`

  if (!src || failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-black font-bold font-mono flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: getCoinColor(symbol), fontSize: size * 0.35 }}
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

// ------- Utilities -------
const genId = (sym: string) => `${sym}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

const sessionROC = (cur: number, start: number) =>
  !start || start === 0 ? 0 : ((cur - start) / start) * 100

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

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`
}

// ------- Sub-components -------

function LiveBadge({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      {status === "connected" ? (
        <>
          <span className="live-dot w-1.5 h-1.5 rounded-full bg-[hsl(var(--gain))]" />
          <span className="text-[10px] tracking-widest uppercase text-[hsl(var(--gain))] font-mono">Live</span>
        </>
      ) : status === "connecting" ? (
        <>
          <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-[10px] text-amber-400 font-mono">Connecting</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5 text-[hsl(220,10%,40%)]" />
          <span className="text-[10px] text-[hsl(220,10%,40%)] font-mono">Offline</span>
        </>
      )}
    </div>
  )
}

function TimeframeToggle({ value, onChange }: { value: MomentumTimeframe; onChange: (t: MomentumTimeframe) => void }) {
  const tfs: MomentumTimeframe[] = ["30s", "1m", "2m", "5m"]
  return (
    <div className="flex items-center gap-0.5 bg-[hsl(220,14%,7%)] rounded-lg p-0.5 border border-[hsl(220,14%,12%)]">
      {tfs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all press-scale ${
            value === t
              ? "bg-[hsl(var(--primary))] text-black font-semibold shadow-sm"
              : "text-[hsl(220,10%,50%)] hover:text-[hsl(220,15%,80%)]"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function Typeahead({
  value, onChange, existing, onSelect,
}: {
  value: string; onChange: (v: string) => void; existing: string[]; onSelect: (p: CoinbaseProduct) => void
}) {
  const [open, setOpen] = useState(false)
  const { products, loading } = useCoinbaseProducts()
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          !existing.includes(p.product_id) &&
          (p.base_currency.toLowerCase().includes(q) || p.base_name.toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [products, value, existing])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const pick = (p: CoinbaseProduct) => { onSelect(p); onChange(""); setOpen(false) }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,35%)] pointer-events-none z-10" />
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(e.target.value.length > 0) }}
        onFocus={() => value.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length > 0) { e.preventDefault(); pick(filtered[0]) }
          if (e.key === "Escape") setOpen(false)
        }}
        placeholder="Search coins..."
        className="pl-9 pr-3 h-9 bg-[hsl(220,14%,7%)] border-[hsl(220,14%,12%)] text-[hsl(220,15%,88%)] placeholder:text-[hsl(220,10%,30%)] font-mono text-sm rounded-lg focus:border-[hsl(var(--primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
      />

      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[hsl(220,16%,8%)] border border-[hsl(220,14%,14%)] rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto animate-fade-in">
          {filtered.map((p) => (
            <button
              key={p.product_id}
              onClick={() => pick(p)}
              className="w-full px-3 py-2.5 text-left hover:bg-[hsl(220,14%,12%)] flex items-center gap-3 transition-colors press-scale"
            >
              <CoinLogo symbol={p.base_currency} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[hsl(220,15%,88%)]">{p.base_currency}</div>
                <div className="text-[11px] text-[hsl(220,10%,45%)]">{p.base_name}</div>
              </div>
              <Plus className="w-3.5 h-3.5 text-[hsl(220,10%,35%)]" />
            </button>
          ))}
        </div>
      )}

      {open && value.length > 0 && filtered.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-[hsl(220,16%,8%)] border border-[hsl(220,14%,14%)] rounded-lg shadow-2xl z-50 p-4 text-center animate-fade-in">
          <p className="text-sm text-[hsl(220,10%,45%)]">No results</p>
        </div>
      )}
    </div>
  )
}

// ------- Position delta badge -------
function PosDelta({ delta }: { delta: number }) {
  if (delta === 0) return <Minus className="w-3 h-3 text-[hsl(220,10%,30%)]" />
  const up = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold ${up ? "text-gain" : "text-loss"}`}>
      {up ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      {Math.abs(delta)}
    </span>
  )
}

// ------- Ranking chart (canvas) -------
function RankingChart({ history, coins }: { history: Map<string, number[]>; coins: CoinData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const pad = { top: 24, right: 70, bottom: 24, left: 16 }
    const w = rect.width - pad.left - pad.right
    const h = rect.height - pad.top - pad.bottom

    if (coins.length === 0) return

    // Zero line
    const maxRank = coins.length
    const yForRank = (rank: number) => pad.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * h

    // Grid
    ctx.strokeStyle = "hsl(220, 14%, 10%)"
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    for (let i = 0; i < maxRank; i++) {
      const y = yForRank(i + 1)
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(pad.left + w, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Draw lines for each coin
    coins.forEach((coin) => {
      const ranks = history.get(coin.id) || []
      if (ranks.length < 2) return

      const color = getCoinColor(coin.symbol)
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = "round"
      ctx.lineCap = "round"
      ctx.globalAlpha = 0.85

      ctx.beginPath()
      ranks.forEach((rank, i) => {
        const x = pad.left + (i / Math.max(ranks.length - 1, 1)) * w
        const y = yForRank(rank)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // End dot + label
      const lastRank = ranks[ranks.length - 1]
      const endX = pad.left + w
      const endY = yForRank(lastRank)

      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(endX, endY, 4, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      ctx.fillStyle = color
      ctx.font = "bold 11px monospace"
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillText(coin.symbol, endX + 10, endY)
    })
    ctx.globalAlpha = 1
  }, [history, coins])

  return (
    <div ref={containerRef} className="w-full h-full min-h-[200px]">
      <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
    </div>
  )
}

// ======= MAIN =======
export default function MomentumTracker() {
  const router = useRouter()

  const [watchlist, setWatchlist] = useState<CoinData[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [raceActive, setRaceActive] = useState(false)
  const [racePaused, setRacePaused] = useState(false)
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [momentumTf, setMomentumTf] = useState<MomentumTimeframe>("1m")
  const [sortField, setSortField] = useState<SortField>("sessionROC")
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table")

  // Ranking history for chart
  const [rankHistory, setRankHistory] = useState<Map<string, number[]>>(new Map())

  const productIds = useMemo(() => watchlist.map((c) => c.coinbaseId), [watchlist])
  const { book, status, error } = useCoinbase(productIds)
  const { products } = useCoinbaseProducts()

  // Previous ranks ref for detecting changes
  const prevRanksRef = useRef<Map<string, number>>(new Map())

  // Update coins from WS
  const updateRef = useRef<() => void>()
  updateRef.current = () => {
    if (Object.keys(book).length === 0) return

    setWatchlist((prev) => {
      let changed = false
      const updated = prev.map((coin) => {
        const series = book[coin.coinbaseId]
        if (!series || series.length === 0) return coin

        const latest = series[series.length - 1]
        if (latest.price === coin.currentPrice && latest.ts === coin.lastUpdated) return coin

        changed = true
        const history: PricePoint[] = series.slice(-OPTIMAL_BUFFER_SIZE).map((p) => ({ price: p.price, timestamp: p.ts }))
        const sROC = raceActive && coin.sessionStartPrice > 0 ? sessionROC(latest.price, coin.sessionStartPrice) : 0
        const mom = calculateMomentum(history, getTimeframeMs(momentumTf))

        return { ...coin, currentPrice: latest.price, priceHistory: history, sessionROC: sROC, momentum: mom, lastUpdated: latest.ts }
      })
      if (!changed) return prev

      // Compute ranks + deltas
      const sorted = [...updated].sort((a, b) => {
        if (sortField === "sessionROC") return b.sessionROC - a.sessionROC
        if (sortField === "momentum") return b.momentum - a.momentum
        return b.currentPrice - a.currentPrice
      })

      const newRanks = new Map<string, number>()
      sorted.forEach((c, i) => newRanks.set(c.id, i + 1))

      const withRanks = updated.map((c) => {
        const newRank = newRanks.get(c.id) || 0
        const oldRank = prevRanksRef.current.get(c.id) || newRank
        const delta = oldRank - newRank // positive = moved up
        const flash = delta > 0 ? "up" as const : delta < 0 ? "down" as const : null
        return { ...c, prevRank: oldRank, rankDelta: delta, rankFlash: flash }
      })

      prevRanksRef.current = newRanks

      // Append to ranking history
      setRankHistory((prev) => {
        const next = new Map(prev)
        withRanks.forEach((c) => {
          const rank = newRanks.get(c.id) || 0
          const arr = next.get(c.id) || []
          arr.push(rank)
          if (arr.length > 120) arr.shift()
          next.set(c.id, arr)
        })
        return next
      })

      return withRanks
    })
  }

  useEffect(() => {
    if (Object.keys(book).length === 0) return
    const iv = setInterval(() => updateRef.current?.(), 500)
    updateRef.current?.()
    return () => clearInterval(iv)
  }, [book])

  useEffect(() => {
    if (!raceActive || racePaused || !raceStartTime) return
    const iv = setInterval(() => setElapsedTime(Date.now() - raceStartTime), 1000)
    return () => clearInterval(iv)
  }, [raceActive, racePaused, raceStartTime])

  // Actions
  const addCoin = useCallback((p: CoinbaseProduct) => {
    setWatchlist((prev) => {
      if (prev.some((c) => c.coinbaseId === p.product_id)) return prev
      return [...prev, {
        id: genId(p.base_currency), symbol: p.base_currency, name: p.base_name,
        coinbaseId: p.product_id, currentPrice: 0, sessionStartPrice: 0, sessionStartTime: 0,
        sessionROC: 0, momentum: 0, lastUpdated: 0, priceHistory: [],
        prevRank: 0, rankDelta: 0, rankFlash: null,
      }]
    })
  }, [])

  const removeCoin = useCallback((id: string) => {
    setWatchlist((prev) => prev.filter((c) => c.id !== id))
    setRankHistory((prev) => { const n = new Map(prev); n.delete(id); return n })
  }, [])

  const startRace = useCallback(() => {
    if (watchlist.length === 0) return
    const now = Date.now()
    setRaceStartTime(now)
    setRaceActive(true)
    setRacePaused(false)
    setElapsedTime(0)
    setRankHistory(new Map())
    prevRanksRef.current = new Map()
    setWatchlist((prev) => prev.map((c) => ({
      ...c, sessionStartPrice: c.currentPrice || 0, sessionStartTime: now, sessionROC: 0, rankDelta: 0, rankFlash: null,
    })))
  }, [watchlist.length])

  const togglePause = useCallback(() => setRacePaused((p) => !p), [])

  const resetRace = useCallback(() => {
    setRaceActive(false); setRacePaused(false); setRaceStartTime(null); setElapsedTime(0)
    setRankHistory(new Map()); prevRanksRef.current = new Map()
    setWatchlist((prev) => prev.map((c) => ({
      ...c, sessionStartPrice: 0, sessionStartTime: 0, sessionROC: 0, rankDelta: 0, rankFlash: null,
    })))
  }, [])

  const sorted = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      if (sortField === "sessionROC") return b.sessionROC - a.sessionROC
      if (sortField === "momentum") return b.momentum - a.momentum
      return b.currentPrice - a.currentPrice
    })
  }, [watchlist, sortField])

  const leader = sorted[0]
  const fastest = [...watchlist].sort((a, b) => b.momentum - a.momentum)[0]
  const topGainerId = sorted[0]?.id
  const topLoserId = sorted.length > 1 ? sorted[sorted.length - 1]?.id : null

  return (
    <div className="min-h-[100dvh] bg-[hsl(220,16%,4%)] text-[hsl(220,15%,88%)] flex flex-col">
      {/* ---- HEADER ---- */}
      <header className="flex-shrink-0 border-b border-[hsl(220,14%,10%)] bg-[hsl(220,16%,5%)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center text-black font-bold text-[11px] font-mono">PD</div>
            <span className="text-sm font-semibold text-[hsl(220,15%,80%)] hidden sm:inline">PurpDex</span>
          </div>
          <LiveBadge status={status} />
        </div>
      </header>

      {/* ---- STAT CARDS ---- */}
      <section className="border-b border-[hsl(220,14%,10%)] bg-[hsl(220,16%,5%)]">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Watchlist", val: String(watchlist.length) },
              { label: "Elapsed", val: raceActive ? fmtTime(elapsedTime) : "0:00" },
              { label: "Leader", val: leader?.symbol || "...", sub: leader && raceActive ? fmtPct(leader.sessionROC) : undefined },
              { label: "Fastest", val: fastest?.symbol || "...", sub: fastest ? `${fmtPct(fastest.momentum)}/${momentumTf}` : undefined },
            ].map((s) => (
              <div key={s.label} className="card-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] mb-1">{s.label}</div>
                <div className="text-lg font-bold font-mono text-[hsl(220,15%,90%)] leading-none">{s.val}</div>
                {s.sub && (
                  <div className={`text-xs font-mono mt-1 ${s.sub.startsWith("+") ? "text-gain" : s.sub.startsWith("-") ? "text-loss" : "text-[hsl(220,10%,45%)]"}`}>
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- CONTROLS ---- */}
      <section className="border-b border-[hsl(220,14%,10%)] bg-[hsl(220,16%,5%)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center gap-2">
            {/* Tab toggle */}
            <div className="flex items-center gap-0.5 bg-[hsl(220,14%,7%)] rounded-lg p-0.5 border border-[hsl(220,14%,12%)]">
              {(["table", "chart"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-md text-[11px] font-mono capitalize transition-all press-scale ${
                    activeTab === t
                      ? "bg-[hsl(var(--primary))] text-black font-semibold"
                      : "text-[hsl(220,10%,50%)] hover:text-[hsl(220,15%,80%)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <TimeframeToggle value={momentumTf} onChange={setMomentumTf} />
          </div>

          {/* Search */}
          <Typeahead
            value={searchQuery}
            onChange={setSearchQuery}
            existing={watchlist.map((c) => c.coinbaseId)}
            onSelect={addCoin}
          />

          {/* Race controls */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!raceActive ? (
              <Button
                onClick={startRace}
                disabled={watchlist.length === 0}
                size="sm"
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(160,80%,42%)] text-black font-mono h-9 rounded-lg press-scale"
              >
                <Flag className="w-3.5 h-3.5 mr-1.5" /> Start
              </Button>
            ) : (
              <>
                <Button
                  onClick={togglePause} size="sm" variant="outline"
                  className="border-[hsl(220,14%,14%)] text-[hsl(220,15%,80%)] hover:bg-[hsl(220,14%,10%)] font-mono h-9 rounded-lg bg-transparent press-scale"
                >
                  <Pause className="w-3.5 h-3.5 mr-1" /> {racePaused ? "Go" : "Pause"}
                </Button>
                <Button
                  onClick={resetRace} size="sm" variant="outline"
                  className="border-[hsl(220,14%,14%)] text-[hsl(220,15%,80%)] hover:bg-[hsl(220,14%,10%)] font-mono h-9 w-9 p-0 rounded-lg bg-transparent press-scale"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ---- MAIN CONTENT ---- */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(220,14%,8%)] border border-[hsl(220,14%,14%)] flex items-center justify-center mb-5">
                <Activity className="w-6 h-6 text-[hsl(220,10%,30%)]" />
              </div>
              <h3 className="text-base font-semibold text-[hsl(220,15%,80%)] mb-1">Add coins to get started</h3>
              <p className="text-sm text-[hsl(220,10%,40%)] max-w-xs">
                Search above to add coins, then start a race to track momentum in real time.
              </p>
            </div>
          ) : activeTab === "table" ? (
            <div className="space-y-1.5 animate-fade-in">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[1fr_100px_90px_90px_36px] items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[hsl(220,10%,35%)] font-mono">
                <span>Asset</span>
                <span className="text-right hidden sm:block">Price</span>
                <button onClick={() => setSortField("sessionROC")} className={`text-right ${sortField === "sessionROC" ? "text-[hsl(var(--primary))]" : ""}`}>
                  Change
                </button>
                <button onClick={() => setSortField("momentum")} className={`text-right ${sortField === "momentum" ? "text-[hsl(var(--primary))]" : ""}`}>
                  ROC
                </button>
                <span />
              </div>

              {sorted.map((coin, idx) => {
                const isTop = coin.id === topGainerId && raceActive && sorted.length > 1
                const isBottom = coin.id === topLoserId && raceActive && sorted.length > 2

                return (
                  <div
                    key={coin.id}
                    onClick={() => router.push(`/coin/${coin.symbol.toLowerCase()}`)}
                    className={`
                      rank-item card-surface grid grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[1fr_100px_90px_90px_36px]
                      items-center gap-2 px-3 py-2.5 cursor-pointer
                      hover:bg-[hsl(220,14%,9%)] transition-colors press-scale
                      ${isTop ? "glow-gain" : isBottom ? "glow-loss" : ""}
                      ${coin.rankFlash === "up" ? "flash-up" : coin.rankFlash === "down" ? "flash-down" : ""}
                    `}
                  >
                    {/* Asset */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-mono text-[hsl(220,10%,30%)] w-4 text-right flex-shrink-0">
                        {idx + 1}
                      </span>
                      <CoinLogo symbol={coin.symbol} size={30} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[hsl(220,15%,90%)]">{coin.symbol}</span>
                          {raceActive && <PosDelta delta={coin.rankDelta} />}
                        </div>
                        <div className="text-[11px] text-[hsl(220,10%,40%)] truncate">{coin.name}</div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right font-mono text-sm text-[hsl(220,15%,80%)] hidden sm:block">
                      ${fmtPrice(coin.currentPrice)}
                    </div>

                    {/* Change % */}
                    <div className={`text-right font-mono text-sm font-medium ${raceActive ? (coin.sessionROC >= 0 ? "text-gain" : "text-loss") : "text-[hsl(220,10%,35%)]"}`}>
                      {raceActive ? fmtPct(coin.sessionROC) : "..."}
                    </div>

                    {/* ROC */}
                    <div className={`text-right font-mono text-sm ${coin.momentum >= 0 ? "text-gain" : "text-loss"}`}>
                      {fmtPct(coin.momentum)}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCoin(coin.id) }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-[hsl(220,10%,30%)] hover:text-[hsl(0,72%,58%)] hover:bg-[hsl(0,72%,58%)/0.1] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ---- CHART VIEW: Ranking over time ---- */
            <div className="card-surface overflow-hidden animate-fade-in">
              <div className="px-4 py-3 border-b border-[hsl(220,14%,10%)] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[hsl(220,15%,85%)]">Position Chart</h2>
                  <p className="text-[11px] text-[hsl(220,10%,40%)]">Ranking changes over time ({`#1 = top`})</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {sorted.map((c) => (
                    <div key={c.id} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCoinColor(c.symbol) }} />
                      <span className="text-[11px] font-mono text-[hsl(220,10%,55%)]">{c.symbol}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 h-[320px] sm:h-[400px]">
                <RankingChart history={rankHistory} coins={sorted} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
