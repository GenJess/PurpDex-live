import { TerminalHeader } from "@/components/terminal-header"
import { CommandBar } from "@/components/command-bar"
import { MarketOverview } from "@/components/market-overview"
import { ChartSection } from "@/components/chart-section"
import { MarketDataTable } from "@/components/market-data-table"
import { NewsFeed } from "@/components/news-feed"
import { CurrenciesSection } from "@/components/currencies-section"
import { CommoditiesSection } from "@/components/commodities-section"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <TerminalHeader />
      <CommandBar />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <MarketOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ChartSection />
          </div>
          <div className="lg:col-span-1">
            <NewsFeed />
          </div>
        </div>

        <MarketDataTable />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CurrenciesSection />
          <CommoditiesSection />
        </div>
      </main>
    </div>
  )
}
