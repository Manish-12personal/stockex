import { Link } from "react-router-dom"
import { Calculator, PieChart, BarChart2, Grid3X3 } from "lucide-react"

const tools = [
  {
    icon: Calculator,
    title: "Brokerage Calculator",
    description: "Calculate your trading costs including brokerage, STT, and other charges.",
    color: "bg-blue-50 text-primary",
    href: "/tools/brokerage-calculator",
  },
  {
    icon: PieChart,
    title: "Profit & Loss Calculator",
    description: "Estimate your potential profits and losses before placing trades.",
    color: "bg-green-50 text-profit-green",
    href: "/tools/profit-loss-calculator",
  },
  {
    icon: BarChart2,
    title: "Margin Calculator",
    description: "Calculate margin requirements for your positions across segments.",
    color: "bg-yellow-50 text-yellow-600",
    href: "/tools/margin-calculator",
  },
  {
    icon: Grid3X3,
    title: "Market Heatmap",
    description: "Visualize market performance with interactive sector heatmaps.",
    color: "bg-purple-50 text-purple-600",
    href: "/tools/market-heatmap",
  },
]

export function TradingToolsSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Tools</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-blue mb-4 text-balance">
            Smart Trading Tools
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful calculators and analysis tools to make informed trading decisions.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tools.map((tool, index) => (
            <Link
              key={index}
              to={tool.href}
              className="group bg-white border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-2 cursor-pointer"
            >
              <div className={`w-16 h-16 rounded-2xl ${tool.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <tool.icon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-deep-blue mb-3">{tool.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
