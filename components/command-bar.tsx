"use client"

import { Search, Command } from "lucide-react"
import { useState } from "react"

export function CommandBar() {
  const [query, setQuery] = useState("")

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="relative">
          <Command className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search securities, news, functions... (e.g., AAPL, GDP, NEWS)"
            className="w-full bg-background/50 border border-border rounded-md pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
          />
        </div>
      </div>
    </div>
  )
}
