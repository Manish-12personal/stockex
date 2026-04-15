import { useState } from "react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Grid3X3, ArrowLeft, TrendingUp, TrendingDown } from "lucide-react"
import { Link } from "react-router-dom"

const sectors = [
  {
    name: "Banking",
    change: 1.85,
    stocks: [
      { name: "HDFC Bank", change: 2.1 },
      { name: "ICICI Bank", change: 1.8 },
      { name: "Kotak Bank", change: 1.5 },
      { name: "Axis Bank", change: 2.3 },
      { name: "SBI", change: 1.2 },
      { name: "IndusInd", change: -0.5 },
    ],
  },
  {
    name: "IT",
    change: -0.65,
    stocks: [
      { name: "TCS", change: -0.8 },
      { name: "Infosys", change: -1.2 },
      { name: "Wipro", change: 0.3 },
      { name: "HCL Tech", change: -0.5 },
      { name: "Tech Mahindra", change: -0.9 },
      { name: "LTIMindtree", change: 0.2 },
    ],
  },
  {
    name: "Pharma",
    change: 0.92,
    stocks: [
      { name: "Sun Pharma", change: 1.5 },
      { name: "Dr Reddy's", change: 0.8 },
      { name: "Cipla", change: 1.2 },
      { name: "Divi's Labs", change: -0.3 },
      { name: "Lupin", change: 1.8 },
      { name: "Biocon", change: 0.5 },
    ],
  },
  {
    name: "Auto",
    change: 1.45,
    stocks: [
      { name: "Tata Motors", change: 2.5 },
      { name: "M&M", change: 1.8 },
      { name: "Maruti", change: 0.9 },
      { name: "Bajaj Auto", change: 1.2 },
      { name: "Hero Moto", change: 0.6 },
      { name: "Eicher", change: 1.5 },
    ],
  },
  {
    name: "Energy",
    change: 2.15,
    stocks: [
      { name: "Reliance", change: 2.8 },
      { name: "ONGC", change: 1.5 },
      { name: "NTPC", change: 2.2 },
      { name: "Power Grid", change: 1.8 },
      { name: "Adani Green", change: 3.2 },
      { name: "Tata Power", change: 1.9 },
    ],
  },
  {
    name: "FMCG",
    change: -0.35,
    stocks: [
      { name: "HUL", change: -0.5 },
      { name: "ITC", change: 0.3 },
      { name: "Nestle", change: -0.8 },
      { name: "Britannia", change: -0.2 },
      { name: "Dabur", change: 0.1 },
      { name: "Marico", change: -0.6 },
    ],
  },
  {
    name: "Metals",
    change: 1.75,
    stocks: [
      { name: "Tata Steel", change: 2.2 },
      { name: "JSW Steel", change: 1.8 },
      { name: "Hindalco", change: 1.5 },
      { name: "Vedanta", change: 2.5 },
      { name: "Coal India", change: 0.8 },
      { name: "NMDC", change: 1.2 },
    ],
  },
  {
    name: "Realty",
    change: 2.85,
    stocks: [
      { name: "DLF", change: 3.5 },
      { name: "Godrej Prop", change: 2.8 },
      { name: "Oberoi Realty", change: 2.2 },
      { name: "Prestige", change: 3.1 },
      { name: "Brigade", change: 2.5 },
      { name: "Sobha", change: 2.9 },
    ],
  },
]

const getColorIntensity = (change) => {
  const absChange = Math.abs(change)
  if (absChange >= 3) return change > 0 ? "bg-green-500" : "bg-red-500"
  if (absChange >= 2) return change > 0 ? "bg-green-500/80" : "bg-red-500/80"
  if (absChange >= 1) return change > 0 ? "bg-green-500/60" : "bg-red-500/60"
  if (absChange >= 0.5) return change > 0 ? "bg-green-500/40" : "bg-red-500/40"
  return change > 0 ? "bg-green-500/20" : "bg-red-500/20"
}

export default function MarketHeatmap() {
  const [selectedSector, setSelectedSector] = useState(null)

  return (
    <main className="min-h-screen bg-deep-blue">
      <Navbar />
      
      <section className="pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Link */}
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-yellow-accent mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Grid3X3 className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Market Heatmap
            </h1>
            <p className="text-white/70 max-w-xl mx-auto">
              Visualize market performance with interactive sector heatmaps. Click on a sector to see individual stocks.
            </p>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-white/70 text-sm">Strong Decline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500/50 rounded"></div>
              <span className="text-white/70 text-sm">Decline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500/50 rounded"></div>
              <span className="text-white/70 text-sm">Gain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-white/70 text-sm">Strong Gain</span>
            </div>
          </div>

          {/* Sector Heatmap Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {sectors.map((sector) => (
              <button
                key={sector.name}
                onClick={() => setSelectedSector(selectedSector === sector.name ? null : sector.name)}
                className={`${getColorIntensity(sector.change)} rounded-xl p-6 text-center transition-all hover:scale-105 ${
                  selectedSector === sector.name ? "ring-2 ring-yellow-accent" : ""
                }`}
              >
                <div className="text-white font-bold text-lg mb-1">{sector.name}</div>
                <div className={`flex items-center justify-center gap-1 ${sector.change >= 0 ? "text-white" : "text-white"}`}>
                  {sector.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="font-semibold">{sector.change >= 0 ? "+" : ""}{sector.change}%</span>
                </div>
              </button>
            ))}
          </div>

          {/* Selected Sector Stocks */}
          {selectedSector && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
              <h3 className="text-xl font-bold text-white mb-6">
                {selectedSector} Stocks
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {sectors.find(s => s.name === selectedSector)?.stocks.map((stock) => (
                  <div
                    key={stock.name}
                    className={`${getColorIntensity(stock.change)} rounded-xl p-4 text-center`}
                  >
                    <div className="text-white font-medium text-sm mb-1">{stock.name}</div>
                    <div className={`flex items-center justify-center gap-1 text-white text-sm`}>
                      {stock.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      <span>{stock.change >= 0 ? "+" : ""}{stock.change}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Summary */}
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <div className="bg-green-500/20 rounded-xl p-6 text-center">
              <div className="text-white/70 text-sm mb-2">Advancing Sectors</div>
              <div className="text-3xl font-bold text-green-400">
                {sectors.filter(s => s.change > 0).length}
              </div>
            </div>
            <div className="bg-red-500/20 rounded-xl p-6 text-center">
              <div className="text-white/70 text-sm mb-2">Declining Sectors</div>
              <div className="text-3xl font-bold text-red-400">
                {sectors.filter(s => s.change < 0).length}
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-6 text-center">
              <div className="text-white/70 text-sm mb-2">Market Sentiment</div>
              <div className="text-3xl font-bold text-yellow-accent">
                {sectors.filter(s => s.change > 0).length > sectors.filter(s => s.change < 0).length ? "Bullish" : "Bearish"}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> This heatmap shows simulated market data for demonstration purposes. 
              Actual market data may vary. Click on any sector to view individual stock performance.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
