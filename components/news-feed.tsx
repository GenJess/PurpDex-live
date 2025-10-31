"use client"

import { Card } from "@/components/ui/card"
import { Clock } from "lucide-react"

interface NewsItem {
  id: string
  title: string
  source: string
  time: string
  category: "markets" | "tech" | "economy" | "breaking"
}

const newsItems: NewsItem[] = [
  {
    id: "1",
    title: "Fed Signals Potential Rate Cut in Q2 2025",
    source: "Reuters",
    time: "2m ago",
    category: "breaking",
  },
  {
    id: "2",
    title: "Tech Stocks Rally on Strong Earnings Reports",
    source: "Bloomberg",
    time: "15m ago",
    category: "markets",
  },
  {
    id: "3",
    title: "Oil Prices Surge Amid Middle East Tensions",
    source: "CNBC",
    time: "32m ago",
    category: "economy",
  },
  {
    id: "4",
    title: "Apple Announces New AI Features for iPhone",
    source: "TechCrunch",
    time: "1h ago",
    category: "tech",
  },
  {
    id: "5",
    title: "European Markets Close Higher on ECB Decision",
    source: "Financial Times",
    time: "2h ago",
    category: "markets",
  },
]

export function NewsFeed() {
  const getCategoryColor = (category: NewsItem["category"]) => {
    switch (category) {
      case "breaking":
        return "text-destructive"
      case "markets":
        return "text-primary"
      case "tech":
        return "text-info"
      case "economy":
        return "text-warning"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border h-full">
      <h2 className="text-lg font-semibold mb-4">Market News</h2>
      <div className="space-y-4">
        {newsItems.map((item) => (
          <div
            key={item.id}
            className="pb-4 border-b border-border/50 last:border-0 last:pb-0 hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-2 mb-1">
              <span className={`text-xs font-semibold uppercase ${getCategoryColor(item.category)}`}>
                {item.category}
              </span>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2 leading-snug">{item.title}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium">{item.source}</span>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{item.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
