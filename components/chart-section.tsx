"use client"

import { Card } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useState, useEffect } from "react"

export function ChartSection() {
  const [timeframe, setTimeframe] = useState("1D")
  const [data, setData] = useState<{ time: string; price: number }[]>([])

  useEffect(() => {
    const generateData = () => {
      const points = 50
      const basePrice = 5127
      return Array.from({ length: points }, (_, i) => ({
        time: `${9 + Math.floor(i / 6)}:${(i % 6) * 10}`,
        price: basePrice + Math.random() * 100 - 50 + i * 0.5,
      }))
    }

    setData(generateData())

    const interval = setInterval(() => {
      setData((prev) => {
        const newData = [...prev.slice(1)]
        const lastPrice = prev[prev.length - 1].price
        const now = new Date()
        newData.push({
          time: `${now.getHours()}:${now.getMinutes()}`,
          price: lastPrice + (Math.random() - 0.5) * 5,
        })
        return newData
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [timeframe])

  const timeframes = ["1D", "5D", "1M", "3M", "1Y", "5Y"]

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">S&P 500 Index</h2>
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}
            domain={["dataMin - 10", "dataMax + 10"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
            }}
          />
          <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
