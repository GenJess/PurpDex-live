"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface Commodity {
  name: string
  symbol: string
  price: number
  change: number
  changePercent: number
  unit: string
}

export function CommoditiesSection() {
  const [commodities, setCommodities] = useState<Commodity[]>([
    { name: "Gold", symbol: "XAU", price: 2034.5, change: 12.3, changePercent: 0.61, unit: "/oz" },
    { name: "Silver", symbol: "XAG", price: 23.45, change: -0.23, changePercent: -0.97, unit: "/oz" },
    { name: "Crude Oil", symbol: "CL", price: 78.92, change: 1.45, changePercent: 1.87, unit: "/bbl" },
    { name: "Natural Gas", symbol: "NG", price: 2.34, change: -0.08, changePercent: -3.31, unit: "/MMBtu" },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setCommodities((prev) =>
        prev.map((commodity) => {
          const randomChange = (Math.random() - 0.5) * 2
          const newPrice = commodity.price + randomChange
          const newChange = commodity.change + randomChange
          const newChangePercent = (newChange / (newPrice - newChange)) * 100

          return {
            ...commodity,
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
      <h2 className="text-lg font-semibold mb-4">Commodities</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {commodities.map((commodity) => (
          <div key={commodity.symbol} className="p-4 bg-background/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-mono font-semibold text-primary">{commodity.symbol}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{commodity.name}</p>
              </div>
              {commodity.change >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-2xl font-bold font-mono">
              ${commodity.price.toFixed(2)}
              <span className="text-xs text-muted-foreground ml-1">{commodity.unit}</span>
            </p>
            <p className={`text-sm font-mono mt-1 ${commodity.change >= 0 ? "text-success" : "text-destructive"}`}>
              {commodity.change >= 0 ? "+" : ""}
              {commodity.change.toFixed(2)} ({commodity.changePercent >= 0 ? "+" : ""}
              {commodity.changePercent.toFixed(2)}%)
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
