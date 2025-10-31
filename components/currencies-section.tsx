"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown } from "lucide-react"
import { useEffect, useState } from "react"

interface Currency {
  pair: string
  rate: number
  change: number
  changePercent: number
}

export function CurrenciesSection() {
  const [currencies, setCurrencies] = useState<Currency[]>([
    { pair: "EUR/USD", rate: 1.0842, change: 0.0023, changePercent: 0.21 },
    { pair: "GBP/USD", rate: 1.2634, change: -0.0012, changePercent: -0.09 },
    { pair: "USD/JPY", rate: 149.87, change: 0.45, changePercent: 0.3 },
    { pair: "USD/CHF", rate: 0.8923, change: 0.0034, changePercent: 0.38 },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrencies((prev) =>
        prev.map((currency) => {
          const randomChange = (Math.random() - 0.5) * 0.01
          const newRate = currency.rate + randomChange
          const newChange = currency.change + randomChange
          const newChangePercent = (newChange / (newRate - newChange)) * 100

          return {
            ...currency,
            rate: Number(newRate.toFixed(4)),
            change: Number(newChange.toFixed(4)),
            changePercent: Number(newChangePercent.toFixed(2)),
          }
        }),
      )
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
      <h2 className="text-lg font-semibold mb-4">Currencies</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currencies.map((currency) => (
          <div key={currency.pair} className="p-4 bg-background/50 rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono font-semibold text-primary">{currency.pair}</span>
              {currency.change >= 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </div>
            <p className="text-2xl font-bold font-mono">{currency.rate.toFixed(4)}</p>
            <p className={`text-sm font-mono mt-1 ${currency.change >= 0 ? "text-success" : "text-destructive"}`}>
              {currency.change >= 0 ? "+" : ""}
              {currency.change.toFixed(4)} ({currency.changePercent >= 0 ? "+" : ""}
              {currency.changePercent.toFixed(2)}%)
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
