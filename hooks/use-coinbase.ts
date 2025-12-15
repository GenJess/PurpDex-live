"use client"
import { useEffect, useRef, useState, useCallback } from "react"

export type TickerPoint = { ts: number; price: number }
export type PriceBook = Record<string, TickerPoint[]>
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

const WS_URL = "wss://advanced-trade-ws.coinbase.com"
const MAX_HISTORY = 300
const BATCH_INTERVAL = 100
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 5

export function useCoinbase(initialProducts: string[] = []) {
  const [book, setBook] = useState<PriceBook>({})
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const subsRef = useRef<string[]>(initialProducts)
  const pendingUpdates = useRef<PriceBook>({})
  const batchTimeout = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const flushUpdates = useCallback(() => {
    if (!mountedRef.current) return
    const updates = pendingUpdates.current
    if (Object.keys(updates).length === 0) return

    setBook((prev) => {
      const next = { ...prev }
      for (const [pid, points] of Object.entries(updates)) {
        const existing = next[pid] || []
        const merged = [...existing, ...points].slice(-MAX_HISTORY)
        next[pid] = merged
      }
      return next
    })
    pendingUpdates.current = {}
  }, [])

  // Dynamic subscription update
  const updateSubscriptions = useCallback((newProducts: string[]) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      subsRef.current = newProducts
      return
    }

    const added = newProducts.filter((p) => !subsRef.current.includes(p))
    const removed = subsRef.current.filter((p) => !newProducts.includes(p))

    if (added.length > 0) {
      ws.send(JSON.stringify({ type: "subscribe", channel: "ticker", product_ids: added }))
    }

    if (removed.length > 0) {
      ws.send(JSON.stringify({ type: "unsubscribe", channel: "ticker", product_ids: removed }))
      // Clear data for unsubscribed products
      setBook((prev) => {
        const copy = { ...prev }
        removed.forEach((p) => delete copy[p])
        return copy
      })
    }

    subsRef.current = newProducts.slice()
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    // Clean up existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {}
    }

    setStatus("connecting")
    setError(null)

    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setStatus("connected")
        setError(null)
        reconnectAttempts.current = 0

        // Subscribe to current products
        if (subsRef.current.length > 0) {
          ws.send(JSON.stringify({ type: "subscribe", channel: "ticker", product_ids: subsRef.current }))
        }
        // Heartbeat for connection monitoring
        ws.send(JSON.stringify({ type: "subscribe", channel: "heartbeats", product_ids: [] }))
      }

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return

        try {
          const msg = JSON.parse(ev.data)
          const channel = msg.channel || msg.type

          if (channel !== "ticker") return

          const events = msg.events || []
          for (const e of events) {
            const tickers = e.tickers || []
            for (const t of tickers) {
              const pid = (t.product_id || "").toUpperCase()
              const price = Number.parseFloat(t.price)
              const ts = Date.parse(t.time || msg.timestamp || new Date().toISOString())

              if (!pid || !Number.isFinite(price)) continue

              if (!pendingUpdates.current[pid]) {
                pendingUpdates.current[pid] = []
              }
              pendingUpdates.current[pid].push({ ts, price })
            }
          }

          // Batch updates
          if (!batchTimeout.current) {
            batchTimeout.current = setTimeout(() => {
              flushUpdates()
              batchTimeout.current = null
            }, BATCH_INTERVAL)
          }
        } catch (parseError) {
          console.error("[useCoinbase] Parse error:", parseError)
        }
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setStatus("error")
        setError("WebSocket connection error")
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setStatus("disconnected")

        // Attempt reconnection
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++
          const delay = RECONNECT_DELAY * reconnectAttempts.current
          reconnectTimeout.current = setTimeout(connect, delay)
        } else {
          setError("Connection lost. Please refresh the page.")
        }
      }
    } catch (err) {
      setStatus("error")
      setError("Failed to connect to price feed")
    }
  }, [flushUpdates])

  // Initial connection
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (batchTimeout.current) clearTimeout(batchTimeout.current)
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {}
      }
    }
  }, [connect])

  // Update subscriptions when products change
  useEffect(() => {
    updateSubscriptions(initialProducts)
  }, [initialProducts.join(","), updateSubscriptions])

  return { book, status, error, updateSubscriptions }
}
