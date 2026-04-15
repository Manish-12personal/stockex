import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { Link } from "react-router-dom"
import { TrendingUp, BarChart3, Gem, DollarSign, ArrowRight } from "lucide-react"

const markets = [
  {
    icon: TrendingUp,
    title: "Stocks",
    description: "Trade India's top equities including Reliance, TCS, Infosys, HDFC Bank, and more. Access real-time market data and execute trades with precision.",
    instruments: ["RELIANCE", "TCS", "INFOSYS", "HDFC BANK", "ICICI BANK", "BHARTI AIRTEL", "ITC", "KOTAK BANK"],
    features: ["Real-time quotes", "Advanced charting", "Portfolio tracking", "Market news"],
    href: "/markets/stocks",
    color: "bg-blue-500",
  },
  {
    icon: BarChart3,
    title: "Indices",
    description: "Trade major Indian indices like NIFTY 50, BANK NIFTY, and SENSEX. Capture market movements with index trading.",
    instruments: ["NIFTY 50", "BANK NIFTY", "SENSEX", "NIFTY IT", "NIFTY MIDCAP", "NIFTY PHARMA"],
    features: ["Index futures", "Options trading", "Low spreads", "High liquidity"],
    href: "/markets/indices",
    color: "bg-green-500",
  },
  {
    icon: Gem,
    title: "Commodities",
    description: "Trade precious metals, energy, and agricultural commodities. Diversify your portfolio with commodity trading.",
    instruments: ["GOLD", "SILVER", "CRUDE OIL", "NATURAL GAS", "COPPER", "ALUMINIUM"],
    features: ["MCX trading", "Commodity futures", "Hedging tools", "Market analysis"],
    href: "/markets/commodities",
    color: "bg-yellow-500",
  },
  {
    icon: DollarSign,
    title: "Currency",
    description: "Trade forex pairs with INR. Access major currency pairs and benefit from currency market movements.",
    instruments: ["USDINR", "EURINR", "GBPINR", "JPYINR", "AUDINR", "CADINR"],
    features: ["Forex trading", "Tight spreads", "24/5 market", "Currency futures"],
    href: "/markets/currency",
    color: "bg-purple-500",
  },
]

export default function Markets() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Multi-Asset Indian Market Access
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8">
            Trade stocks, indices, commodities, and currencies on a single platform with real-time data and powerful trading tools.
          </p>
          <Button className="bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold px-8 py-6 text-lg">
            Start Trading Now
          </Button>
        </div>
      </section>

      {/* Markets Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {markets.map((market, index) => (
              <div key={index} className="bg-white border-2 border-border rounded-2xl p-8 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                <div className={`w-14 h-14 ${market.color} rounded-2xl flex items-center justify-center mb-6`}>
                  <market.icon className="w-7 h-7 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-deep-blue mb-4">{market.title}</h2>
                <p className="text-muted-foreground mb-6">{market.description}</p>
                
                {/* Instruments */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-deep-blue mb-3">Popular Instruments</h4>
                  <div className="flex flex-wrap gap-2">
                    {market.instruments.map((instrument, i) => (
                      <span key={i} className="px-3 py-1 bg-muted rounded-full text-xs font-medium text-foreground">
                        {instrument}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Features */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-deep-blue mb-3">Features</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {market.features.map((feature, i) => (
                      <span key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-profit-green rounded-full"></span>
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                <Link to={market.href}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white">
                    Explore {market.title}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-deep-blue">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Start Trading?
          </h2>
          <p className="text-lg text-white/70 mb-8">
            Open your account today and access all Indian markets from a single platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold px-8">
              Open Live Account
            </Button>
            <Link to="/demo-trading">
              <Button className="bg-white hover:bg-white/90 text-deep-blue font-semibold px-8">
                Try Demo Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
