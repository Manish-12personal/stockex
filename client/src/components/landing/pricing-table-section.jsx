
import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

const instruments = [
  { name: "RELIANCE", price: 2847.50, change: 2.35, category: "Stocks", market: "NSE" },
  { name: "NIFTY 50", price: 22456.80, change: 0.85, category: "Indices", market: "NSE" },
  { name: "BANK NIFTY", price: 47892.15, change: -0.42, category: "Indices", market: "NSE" },
  { name: "GOLD", price: 71250.00, change: 1.12, category: "Commodities", market: "MCX" },
  { name: "USDINR", price: 83.42, change: -0.15, category: "Currency", market: "NSE" },
  { name: "TCS", price: 3892.40, change: 1.15, category: "Stocks", market: "NSE" },
  { name: "INFOSYS", price: 1567.80, change: -0.45, category: "Stocks", market: "NSE" },
  { name: "CRUDE OIL", price: 6542.00, change: 0.78, category: "Commodities", market: "MCX" },
]

export function PricingTableSection() {
  const [activeTab, setActiveTab] = useState("All")
  const [prices, setPrices] = useState(instruments)

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(instrument => ({
        ...instrument,
        price: instrument.price + (Math.random() - 0.5) * 0.002 * instrument.price,
        change: instrument.change + (Math.random() - 0.5) * 0.05
      })))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const tabs = ["All", "Stocks", "Indices", "Commodities", "Currency"]

  const filteredPrices = activeTab === "All" 
    ? prices 
    : prices.filter(p => p.category === activeTab)

  return (
    <section className="py-20 lg:py-28 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Live Data</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-blue mb-4 text-balance">
            Real-Time Market Prices
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Track live prices across Indian markets with instant updates.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-lg shadow-primary/25"
                  : "bg-white text-muted-foreground hover:bg-muted border border-border"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Pricing Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-deep-blue text-white">
                  <th className="text-left py-4 px-6 text-sm font-semibold">Instrument</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Price</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Change</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPrices.map((instrument, index) => (
                  <tr key={index} className="hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {instrument.name.substring(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold text-deep-blue">{instrument.name}</div>
                          <div className="text-xs text-muted-foreground">{instrument.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-deep-blue">
                      ?{instrument.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${
                        instrument.change >= 0 
                          ? "bg-green-50 text-green-600" 
                          : "bg-red-50 text-red-600"
                      }`}>
                        {instrument.change >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {instrument.change >= 0 ? "+" : ""}{instrument.change.toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
                        {instrument.market}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
