
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
  Clock, 
  TrendingUp, 
  Shield, 
  Wallet, 
  BarChart3,
  Globe,
  Zap,
  Lock
} from "lucide-react"

const stats = [
  { value: "60+", label: "Currency Pairs" },
  { value: "0.0", label: "Spreads from (pips)", suffix: " pips" },
  { value: "1:1000", label: "Leverage up to*" },
  { value: "24/5", label: "Professional Support" },
]

const quickSymbols = [
  { symbol: "FX:EURUSD", label: "EURUSD" },
  { symbol: "FX:GBPUSD", label: "GBPUSD" },
  { symbol: "FX:USDJPY", label: "USDJPY" },
  { symbol: "OANDA:XAUUSD", label: "XAUUSD" },
]

const benefits = [
  {
    icon: Clock,
    title: "24/5 Market Access",
    description: "Trade around the clock across major financial centres from Sydney to New York.",
  },
  {
    icon: TrendingUp,
    title: "Deep ECN Liquidity",
    description: "Access aggregated Tier-1 liquidity for minimal slippage on your orders.",
  },
  {
    icon: Wallet,
    title: "Raw Spreads",
    description: "Raw spreads from 0.0 pips with transparent commission-based pricing for professional strategies.",
  },
  {
    icon: Globe,
    title: "Wide Choice of Pairs",
    description: "Trade majors, minors, and exotic currency pairs all from a single account.",
  },
  {
    icon: Shield,
    title: "Hedging & Diversification",
    description: "Use forex to hedge portfolio risk or diversify your trading strategy.",
  },
  {
    icon: Zap,
    title: "ECN Execution",
    description: "Ultra-fast execution with aggregated Tier-1 liquidity providers.",
  },
]

const advancedFeatures = [
  {
    icon: BarChart3,
    title: "Raw Spread Accounts",
    description: "Raw spreads from 0.0 pips with commission-based transparent pricing.",
  },
  {
    icon: Zap,
    title: "Advanced Order Types",
    description: "Algorithmic execution through industry-standard platforms.",
  },
  {
    icon: Lock,
    title: "Negative Balance Protection",
    description: "Segregated fund custody and protection against negative balances.",
  },
]

const faqs = [
  {
    question: "What is the minimum deposit?",
    answer: "$100 for standard accounts; other account types may vary.",
  },
  {
    question: "What leverage is available?",
    answer: "Up to 1:1000* — subject to regulatory limits and instrument.",
  },
  {
    question: "How are spreads calculated?",
    answer: "Spreads are derived from aggregated liquidity providers; raw accounts add a transparent commission.",
  },
  {
    question: "What are the trading hours?",
    answer: "Forex markets operate 24/5 — specific instrument hours shown in the instrument table.",
  },
]

export default function ForexPage() {
  const [instruments, setInstruments] = useState([])
  const [chartSymbol, setChartSymbol] = useState("FX:EURUSD")

  useEffect(() => {
    fetch("/api/markets/forex/instruments")
      .then((res) => res.json())
      .then((data) => setInstruments(data.instruments))
      .catch(console.error)
  }, [])

  const handleLoadChart = useCallback((symbol) => {
    setChartSymbol(`FX:${symbol}`)
    if (typeof window !== "undefined") {
      localStorage.setItem("vxness_chart_symbol", `FX:${symbol}`)
    }
    document.getElementById("live-chart")?.scrollIntoView({ behavior: "smooth" })
  }, [])

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      <MarketHero
        headline="Trade Forex with Institutional Precision"
        subhead="60+ currency pairs, raw spreads from 0.0 pips, dynamic leverage up to 1:1000*, and 24/5 specialist support — all from a single account."
        ctaPrimary="Open Account"
        ctaSecondary="Download Platform"
      />

      <PlatformBlurb />

      <StatsBanner stats={stats} />

      <div id="live-chart">
        <TradingViewChart
          title="Live Forex Market Snapshot"
          defaultSymbol={chartSymbol}
          quickSymbols={quickSymbols}
        />
      </div>

      <InstrumentTable
        title="Instruments & Specifications"
        description="The table below lists contract specifications for our most actively traded forex pairs. Data is updated regularly; consult the instrument contract before trading."
        instruments={instruments}
        onLoadChart={handleLoadChart}
      />

      <WhatIsSection
        title="What is Forex Trading?"
        content="Forex is the global exchange of currencies — the world's largest financial market. Traders speculate on currency pair price movements using leverage and margin to amplify capital efficiency. CFDs provide market exposure without physical currency delivery."
      />

      <BenefitsGrid
        title="Benefits & Use Cases"
        benefits={benefits}
      />

      <BenefitsGrid
        title="Advanced Infrastructure"
        benefits={advancedFeatures}
      />

      <FAQAccordion faqs={faqs} />

      <CTABar
        title="Ready to trade?"
        description="Open an account today and connect to deep liquidity with institutional-grade pricing."
        ctaText="Open Account"
      />

      <Footer />
    </main>
  )
}
