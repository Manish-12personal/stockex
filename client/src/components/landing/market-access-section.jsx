import { TrendingUp, BarChart3, Coins, Banknote } from "lucide-react"
import { StartTradingDialog } from "@/components/landing/auth-dialogs"

const markets = [
  {
    icon: TrendingUp,
    title: "Stocks",
    description: "Trade Indian equities like Reliance, TCS, Infosys with real-time market data.",
    color: "bg-blue-50 text-primary",
  },
  {
    icon: BarChart3,
    title: "Indices",
    description: "Trade NIFTY 50, BANK NIFTY, SENSEX with tight spreads and fast execution.",
    color: "bg-green-50 text-profit-green",
  },
  {
    icon: Coins,
    title: "Commodities",
    description: "Gold, Silver, Crude Oil and Natural Gas with competitive pricing.",
    color: "bg-yellow-50 text-yellow-600",
  },
  {
    icon: Banknote,
    title: "Currency",
    description: "USDINR, EURINR, GBPINR, JPYINR with deep liquidity.",
    color: "bg-purple-50 text-purple-600",
  },
]

export function MarketAccessSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Markets</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-blue mb-4 text-balance">
            Multi-Asset Indian Market Access
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access India's top financial markets through a single integrated platform.
          </p>
        </div>

        {/* Market Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {markets.map((market, index) => (
            <StartTradingDialog
              key={index}
              trigger={
                <div className="group bg-white border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2 cursor-pointer">
                  <div className={`w-16 h-16 rounded-2xl ${market.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <market.icon className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-deep-blue mb-3">{market.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{market.description}</p>
                </div>
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}
