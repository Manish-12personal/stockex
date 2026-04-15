import { TrendingUp, TrendingDown } from "lucide-react"

const tickerData = [
  { symbol: "RELIANCE", price: "2,847.50", change: "+1.25%", isUp: true },
  { symbol: "TCS", price: "3,892.30", change: "+0.85%", isUp: true },
  { symbol: "HDFCBANK", price: "1,678.45", change: "-0.32%", isUp: false },
  { symbol: "INFY", price: "1,456.20", change: "+1.12%", isUp: true },
  { symbol: "ICICIBANK", price: "1,089.75", change: "+0.67%", isUp: true },
  { symbol: "NIFTY 50", price: "22,456.80", change: "+0.92%", isUp: true },
  { symbol: "BANKNIFTY", price: "47,892.35", change: "-0.18%", isUp: false },
  { symbol: "SENSEX", price: "73,876.50", change: "+0.78%", isUp: true },
  { symbol: "GOLD", price: "62,450.00", change: "+0.45%", isUp: true },
  { symbol: "CRUDE", price: "6,780.25", change: "-1.05%", isUp: false },
  { symbol: "USDINR", price: "83.42", change: "+0.12%", isUp: true },
  { symbol: "TATAMOTORS", price: "987.60", change: "+2.35%", isUp: true },
]

export function LiveTicker() {
  return (
    <div className="bg-deep-blue border-y border-white/10 overflow-hidden">
      <div className="flex animate-ticker">
        {/* Duplicate the ticker items for seamless loop */}
        {[...tickerData, ...tickerData].map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 px-6 py-3 border-r border-white/10 whitespace-nowrap"
          >
            <span className="font-semibold text-white text-sm">{item.symbol}</span>
            <span className="text-white/80 text-sm">₹{item.price}</span>
            <span className={`flex items-center gap-1 text-sm font-medium ${item.isUp ? "text-green-400" : "text-red-400"}`}>
              {item.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
