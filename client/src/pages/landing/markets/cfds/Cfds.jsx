
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
  Zap, 
  TrendingUp, 
  TrendingDown,
  Layers,
  GraduationCap,
  ShieldCheck,
  Calculator,
  Bell
} from "lucide-react"

const stats = [
  { value: "50+", label: "CFD Instruments" },
  { value: "1:1000", label: "Leverage up to*" },
  { value: "0.0", label: "Raw/Variable Spreads" },
  { value: "24/5", label: "Market Access" },
]

const quickSymbols = [
  { symbol: "DJ:DJI", label: "US30" },
  { symbol: "SP:SPX", label: "US500" },
  { symbol: "NASDAQ:NDX", label: "USTEC" },
  { symbol: "BITSTAMP:BTCUSD", label: "BTCUSD" },
]

const benefits = [
  {
    icon: Zap,
    title: "Fast Execution",
    description: "Lightning-fast execution and deep liquidity for derivatives trading.",
  },
  {
    icon: TrendingUp,
    title: "Long Positions",
    description: "Go long to capitalize on rising markets with leveraged exposure.",
  },
  {
    icon: TrendingDown,
    title: "Short Positions",
    description: "Go short to profit from falling markets — all from a single account.",
  },
  {
    icon: Layers,
    title: "Granular Position Sizing",
    description: "Micro-lots available on select instruments for precise position management.",
  },
  {
    icon: GraduationCap,
    title: "Educational Content",
    description: "Access demo environments and educational materials for strategy testing.",
  },
]

const riskTools = [
  {
    icon: ShieldCheck,
    title: "Stop-Loss & Take-Profit",
    description: "Set automatic exit levels to manage risk and lock in profits.",
  },
  {
    icon: Calculator,
    title: "Margin Calculators",
    description: "Calculate margin requirements and position sizes before trading.",
  },
  {
    icon: Bell,
    title: "Volatility Alerts",
    description: "Get notified of significant market movements and volatility spikes.",
  },
]

const faqs = [
  {
    question: "What markets are available?",
    answer: "Forex, Stocks, Indices, Commodities, Crypto and ETFs via CFDs.",
  },
  {
    question: "Is there a demo account?",
    answer: "Yes — request a demo to practice without real funds.",
  },
  {
    question: "Are commissions charged?",
    answer: "Varies by instrument — some raw accounts use commission + spread, others have variable spread only.",
  },
  {
    question: "What is the minimum deposit?",
    answer: "$100 for standard accounts; other account types may vary.",
  },
]

export default function CFDsPage() {
  const [instruments, setInstruments] = useState([])
  const [chartSymbol, setChartSymbol] = useState("DJ:DJI")

  useEffect(() => {
    fetch("/api/markets/cfds/instruments")
      .then((res) => res.json())
      .then((data) => setInstruments(data.instruments))
      .catch(console.error)
  }, [])

  const handleLoadChart = useCallback((symbol) => {
    const symbolMap = {
      "US30": "DJ:DJI",
      "US500": "SP:SPX",
      "USTEC": "NASDAQ:NDX",
      "BTCUSD": "BITSTAMP:BTCUSD",
      "ETHUSD": "BITSTAMP:ETHUSD",
      "AAPL": "NASDAQ:AAPL",
      "TSLA": "NASDAQ:TSLA",
      "GOOGL": "NASDAQ:GOOGL",
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
        headline="Trade Global Markets via CFDs"
        subhead="Over 50 CFD instruments — Forex, indices, commodities, and crypto — with competitive spreads, rapid execution and flexible margining."
        ctaPrimary="Open Account"
        ctaSecondary="View Instruments"
      />

      <PlatformBlurb />

      <StatsBanner stats={stats} />

      <div id="live-chart">
        <TradingViewChart
          title="Live CFD Chart — US30 Default"
          defaultSymbol={chartSymbol}
          quickSymbols={quickSymbols}
        />
      </div>

      <InstrumentTable
        title="CFD Instruments & Specifications"
        description="Explore our full range of CFD instruments including indices, stocks, crypto and more. Click any row to load it on the chart."
        instruments={instruments}
        onLoadChart={handleLoadChart}
      />

      <WhatIsSection
        title="What is CFD Trading?"
        content="CFDs (Contracts for Difference) let traders speculate on price changes across markets without owning the underlying asset. Positions can be opened long or short to capitalize on market moves."
      />

      <BenefitsGrid
        title="Why Trade CFDs With VXNESS"
        benefits={benefits}
      />

      <BenefitsGrid
        title="Risk Management & Tools"
        benefits={riskTools}
      />

      <FAQAccordion faqs={faqs} />

      <CTABar
        title="Explore CFD Markets"
        description="View full instruments and add to watchlist."
        ctaText="Open Account"
      />

      <Footer />
    </main>
  )
}
