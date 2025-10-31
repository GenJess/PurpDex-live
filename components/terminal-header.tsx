"use client"

import { Activity } from "lucide-react"

export function TerminalHeader() {
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  return (
    <header className="border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-primary font-mono tracking-tight">BLOOMBERG TERMINAL</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-success animate-pulse" />
              <span className="font-mono">LIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-muted-foreground">Market Status:</span>
              <span className="ml-2 text-success font-semibold">OPEN</span>
            </div>
            <div className="text-sm font-mono text-muted-foreground">{currentTime}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
