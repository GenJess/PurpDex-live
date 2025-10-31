"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface Stock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: string
  marketCap: string
}

export function MarketDataTable() {
  const [stocks, setStocks] = useState<Stock[]>([
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      price: 178.45,
      change: 2.34,
      changePercent: 1.33,
      volume: "52.3M",
      marketCap: "2.8T",
    },
    {
      symbol: "MSFT",
      name: "Microsoft Corp.",
      price: 412.78,
      change: -1.23,
      changePercent: -0.3,
      volume: "23.1M",
      marketCap: "3.1T",
    },
    {
      symbol: "GOOGL",
      name: "Alphabet Inc.",
      price: 142.56,
      change: 3.45,
      changePercent: 2.48,
      volume: "28.7M",
      marketCap: "1.8T",
    },
    {
      symbol: "AMZN",
      name: "Amazon.com Inc.",
      price: 178.23,
      change: 4.12,
      changePercent: 2.37,
      volume: "45.2M",
      marketCap: "1.9T",
    },
    {
      symbol: "NVDA",
      name: "NVIDIA Corp.",
      price: 875.34,
      change: 12.45,
      changePercent: 1.44,
      volume: "38.9M",
      marketCap: "2.2T",
    },
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      price: 248.67,
      change: -5.23,
      changePercent: -2.06,
      volume: "89.4M",
      marketCap: "789B",
    },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) =>
        prev.map((stock) => {
          const randomChange = (Math.random() - 0.5) * 2
          const newPrice = stock.price + randomChange
          const newChange = stock.change + randomChange
          const newChangePercent = (newChange / (newPrice - newChange)) * 100

          return {
            ...stock,
            price: Number(newPrice.toFixed(2)),
            change: Number(newChange.toFixed(2)),
            changePercent: Number(newChangePercent.toFixed(2)),
          }
        }),
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
      <h2 className="text-lg font-semibold mb-4">Market Movers</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 font-semibold text-muted-foreground">Symbol</th>
              <th className="text-left py-3 px-2 font-semibold text-muted-foreground">Name</th>
              <th className="text-right py-3 px-2 font-semibold text-muted-foreground">Price</th>
              <th className="text-right py-3 px-2 font-semibold text-muted-foreground">Change</th>
              <th className="text-right py-3 px-2 font-semibold text-muted-foreground">Change %</th>
              <th className="text-right py-3 px-2 font-semibold text-muted-foreground">Volume</th>
              <th className="text-right py-3 px-2 font-semibold text-muted-foreground">Market Cap</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.symbol} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                <td className="py-3 px-2 font-mono font-semibold text-primary">{stock.symbol}</td>
                <td className="py-3 px-2">{stock.name}</td>
                <td className="py-3 px-2 text-right font-mono">${stock.price.toFixed(2)}</td>
                <td
                  className={`py-3 px-2 text-right font-mono ${stock.change >= 0 ? "text-success" : "text-destructive"}`}
                >
                  <div className="flex items-center justify-end gap-1">
                    {stock.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stock.change >= 0 ? "+" : ""}
                    {stock.change.toFixed(2)}
                  </div>
                </td>
                <td
                  className={`py-3 px-2 text-right font-mono ${stock.changePercent >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {stock.changePercent >= 0 ? "+" : ""}
                  {stock.changePercent.toFixed(2)}%
                </td>
                <td className="py-3 px-2 text-right font-mono text-muted-foreground">{stock.volume}</td>
                <td className="py-3 px-2 text-right font-mono text-muted-foreground">{stock.marketCap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
