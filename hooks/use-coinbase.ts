"use client"
import { useEffect, useRef, useState } from "react"

export type TickerPoint = { ts: number; price: number }
export type PriceBook = Record<string, TickerPoint[]>

const WS_URL = "wss://advanced-trade-ws.coinbase.com"

export function useCoinbase(products: string[]) {
  const [book, setBook] = useState<PriceBook>({})
  const wsRef = useRef<WebSocket | null>(null)
  const subsRef = useRef<string[]>([])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      const subscribe = (channel: string, ids: string[]) =>
        ws.send(
          JSON.stringify({
            type: "subscribe",
            channel,
            product_ids: ids,
          }),
        )
      subscribe("ticker", products)
      subscribe("heartbeats", [])
      subsRef.current = products.slice()
    }

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      const channel = msg.channel || msg.type
      if (channel !== "ticker") return
      const events = msg.events || []
      for (const e of events) {
        const arr = e.tickers || []
        for (const t of arr) {
          const pid = (t.product_id || "").toUpperCase()
          const p = Number.parseFloat(t.price)
          const ts = Date.parse(t.time || msg.timestamp || new Date().toISOString())
          if (!pid || !Number.isFinite(p)) continue
          setBook((prev) => {
            const copy = { ...prev }
            const series = (copy[pid] || []).slice(-300)
            series.push({ ts, price: p })
            copy[pid] = series
            return copy
          })
        }
      }
    }

    const close = () => {
      try {
        ws.close()
      } catch {}
    }
    ws.onclose = close
    ws.onerror = close
    return () => close()
  }, [products.join(",")])

  return { book }
}
