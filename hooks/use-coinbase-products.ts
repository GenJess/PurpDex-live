"use client"
import { useEffect, useState } from "react"

export interface CoinbaseProduct {
  product_id: string
  base_currency: string
  quote_currency: string
  base_name: string
  status: string
  trading_disabled: boolean
}

export function useCoinbaseProducts() {
  const [products, setProducts] = useState<CoinbaseProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchProducts() {
      try {
        // Using Coinbase public API for product list
        const response = await fetch("https://api.exchange.coinbase.com/products")

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()

        if (!mounted) return

        // Filter to USD pairs that are online and tradeable
        const usdProducts = data
          .filter((p: any) => p.quote_currency === "USD" && p.status === "online" && !p.trading_disabled)
          .map((p: any) => ({
            product_id: p.id,
            base_currency: p.base_currency,
            quote_currency: p.quote_currency,
            base_name: p.base_name || p.base_currency,
            status: p.status,
            trading_disabled: p.trading_disabled,
          }))
          .sort((a: CoinbaseProduct, b: CoinbaseProduct) => a.base_currency.localeCompare(b.base_currency))

        setProducts(usdProducts)
        setError(null)
      } catch (err) {
        if (!mounted) return
        console.error("[useCoinbaseProducts] Fetch error:", err)
        setError("Failed to load products")
        // Fallback to common pairs
        setProducts([
          {
            product_id: "BTC-USD",
            base_currency: "BTC",
            quote_currency: "USD",
            base_name: "Bitcoin",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "ETH-USD",
            base_currency: "ETH",
            quote_currency: "USD",
            base_name: "Ethereum",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "SOL-USD",
            base_currency: "SOL",
            quote_currency: "USD",
            base_name: "Solana",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "DOGE-USD",
            base_currency: "DOGE",
            quote_currency: "USD",
            base_name: "Dogecoin",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "ADA-USD",
            base_currency: "ADA",
            quote_currency: "USD",
            base_name: "Cardano",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "AVAX-USD",
            base_currency: "AVAX",
            quote_currency: "USD",
            base_name: "Avalanche",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "LINK-USD",
            base_currency: "LINK",
            quote_currency: "USD",
            base_name: "Chainlink",
            status: "online",
            trading_disabled: false,
          },
          {
            product_id: "UNI-USD",
            base_currency: "UNI",
            quote_currency: "USD",
            base_name: "Uniswap",
            status: "online",
            trading_disabled: false,
          },
        ])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchProducts()

    return () => {
      mounted = false
    }
  }, [])

  return { products, loading, error }
}
