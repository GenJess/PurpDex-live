"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface MarketIndex {
  name: string
  symbol: string
  value: number
  change: number
  changePercent: number
}

export function MarketOverview() {
  const [indices, setIndices] = useState<MarketIndex[]>([
    { name: "S&P 500", symbol: "SPX", value: 5127.79, change: 45.32, changePercent: 0.89 },
    { name: "NASDAQ", symbol: "COMP", value: 16274.94, change: 123.45, changePercent: 0.76 },
    { name: "DOW JONES", symbol: "DJI", value: 38790.43, change: -89.21, changePercent: -0.23 },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setIndices((prev) =>
        prev.map((index) => {
          const randomChange = (Math.random() - 0.5) * 10
          const newValue = index.value + randomChange
          const newChange = index.change + randomChange
          const newChangePercent = (newChange / (newValue - newChange)) * 100

          return {
            ...index,
            value: Number(newValue.toFixed(2)),
            change: Number(newChange.toFixed(2)),
            changePercent: Number(newChangePercent.toFixed(2)),
          }
        }),
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {indices.map((index) => (
        <Card
          key={index.symbol}
          className="p-4 bg-card/50 backdrop-blur-sm border-border hover:bg-card/70 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{index.symbol}</p>
              <h3 className="text-sm font-semibold mt-1">{index.name}</h3>
            </div>
            {index.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold font-mono">{index.value.toLocaleString()}</p>
            <p className={`text-sm font-mono mt-1 ${index.change >= 0 ? "text-success" : "text-destructive"}`}>
              {index.change >= 0 ? "+" : ""}
              {index.change.toFixed(2)} ({index.changePercent >= 0 ? "+" : ""}
              {index.changePercent.toFixed(2)}%)
            </p>
          </div>
        </Card>
      ))}
    </div>
  )
}
