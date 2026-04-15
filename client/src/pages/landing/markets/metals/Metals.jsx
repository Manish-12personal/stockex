
import { useEffect, useState, useCallback } from "react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { MarketHero } from "@/components/landing/markets/market-hero"
import { StatsBanner } from "@/components/landing/markets/stats-banner"
import { TradingViewChart } from "@/components/landing/markets/tradingview-chart"
import { InstrumentTable } from "@/components/landing/markets/instrument-table"
import { BenefitsGrid } from "@/components/landing/markets/benefits-grid"
import { FAQAccordion } from "@/components/landing/markets/faq-accordion"
import { CTABar } from "@/components/landing/markets/cta-bar"
import { PlatformBlurb } from "@/components/landing/markets/platform-blurb"
import { WhatIsSection } from "@/components/landing/markets/what-is-section"
import { 
  Shield, 
  TrendingUp,
  Droplets,
  PieChart
} from "lucide-react"

const stats = [
  { value: "0.12", label: "Gold spreads from (pts)" },
  { value: "0.02", label: "Silver spreads from (pts)" },
  { value: "1:1000", label: "Leverage up to*" },
  { value: "24/5", label: "Execution" },
]

const quickSymbols = [
  { symbol: "OANDA:XAUUSD", label: "XAUUSD" },
  { symbol: "OANDA:XAGUSD", label: "XAGUSD" },
  { symbol: "TVC:PLATINUM", label: "XPTUSD" },
  { symbol: "TVC:PALLADIUM", label: "XPDUSD" },
]

const benefits = [
  {
    icon: Shield,
    title: "Safe-Haven Assets",
    description: "Precious metals have historically served as safe-haven investments during market uncertainty.",
  },
  {
    icon: TrendingUp,
    title: "Inflation Hedge",
    description: "Gold and silver have traditionally been used as hedges against inflation.",
  },
  {
    icon: Droplets,
    title: "High Liquidity",
    description: "Trade major metal pairs with deep liquidity and tight spreads.",
  },
  {
    icon: PieChart,
    title: "Portfolio Diversification",
    description: "Diversify your portfolio with non-correlated precious metals assets.",
  },
]

const faqs = [
  {
    question: "What is the minimum deposit?",
    answer: "$100.",
  },
  {
    question: "What are typical spreads?",
    answer: "Gold from 0.12 points; silver from 0.02 points.",
  },
  {
    question: "What leverage is available?",
    answer: "Up to 1:1000* depending on regulation and instrument.",
  },
  {
    question: "What precious metals can I trade?",
    answer: "Gold, Silver, Platinum and Palladium against USD and EUR.",
  },
]

export default function MetalsPage() {
  const [instruments, setInstruments] = useState([])
  const [chartSymbol, setChartSymbol] = useState("OANDA:XAUUSD")

  useEffect(() => {
    fetch("/api/markets/metals/instruments")
      .then((res) => res.json())
      .then((data) => setInstruments(data.instruments))
      .catch(console.error)
  }, [])

  const handleLoadChart = useCallback((symbol) => {
    const symbolMap = {
      "XAUUSD": "OANDA:XAUUSD",
      "XAGUSD": "OANDA:XAGUSD",
      "XPTUSD": "TVC:PLATINUM",
      "XPDUSD": "TVC:PALLADIUM",
      "XAUEUR": "OANDA:XAUEUR",
      "XAGEUR": "OANDA:XAGEUR",
    }
    const mappedSymbol = symbolMap[symbol] || symbol
    setChartSymbol(mappedSymbol)
    if (typeof window !== "undefined") {
      localStorage.setItem("vxness_chart_symbol", mappedSymbol)
    }
    document.getElementById("live-chart")?.scrollIntoView({ behavior: "smooth" })
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      <MarketHero
        headline="Trade Precious Metals with Institutional Standards"
        subhead="Gold, Silver, Platinum and Palladium with tight spreads (gold from 0.12 pts), deep liquidity and professional support."
        ctaPrimary="Trade Metals"
        ctaSecondary="View Specs"
      />

      <PlatformBlurb />

      <StatsBanner stats={stats} />

      <div id="live-chart">
        <TradingViewChart
          title="Live Metals Chart — Default XAUUSD (Gold)"
          defaultSymbol={chartSymbol}
          quickSymbols={quickSymbols}
        />
      </div>

      <InstrumentTable
        title="Precious Metals Instruments & Specifications"
        description="Trade gold, silver, platinum and palladium with institutional-grade pricing. Click any row to load it on the chart."
        instruments={instruments}
        onLoadChart={handleLoadChart}
      />

      <WhatIsSection
        title="Why Trade Precious Metals?"
        content="Precious metals offer safe-haven and inflation hedge properties with high liquidity for major metal pairs. They provide portfolio diversification with non-correlated assets that have maintained value through centuries of market cycles."
      />

      <BenefitsGrid
        title="Benefits of Metals Trading"
        benefits={benefits}
      />

      <FAQAccordion faqs={faqs} />

      <CTABar
        title="Ready to trade precious metals?"
        description="Open an account today and access gold, silver, platinum and palladium."
        ctaText="Open Account"
      />

      <Footer />
    </main>
  )
}
