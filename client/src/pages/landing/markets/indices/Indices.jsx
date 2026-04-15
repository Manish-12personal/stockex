
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
  DollarSign, 
  Activity,
  Gauge,
  Globe
} from "lucide-react"

const stats = [
  { value: "20+", label: "Global Indices" },
  { value: "0.4", label: "Spreads from (points)" },
  { value: "1:1000", label: "Leverage up to*" },
  { value: "24/5", label: "Market Access" },
]

const quickSymbols = [
  { symbol: "DJ:DJI", label: "US30" },
  { symbol: "SP:SPX", label: "US500" },
  { symbol: "NASDAQ:NDX", label: "USTEC" },
  { symbol: "XETR:DAX", label: "DAX40" },
]

const benefits = [
  {
    icon: DollarSign,
    title: "Cost-Efficient Exposure",
    description: "Gain exposure to major economies without buying individual equities.",
  },
  {
    icon: Activity,
    title: "High Intraday Volatility",
    description: "Take advantage of significant price movements for short-term trading strategies.",
  },
  {
    icon: Gauge,
    title: "Tight Spreads",
    description: "Competitive spreads and margining designed for active traders.",
  },
  {
    icon: Globe,
    title: "Global Coverage",
    description: "Access indices from US, Europe, Asia and Australia markets.",
  },
]

const faqs = [
  {
    question: "What is the minimum deposit for indices?",
    answer: "$100 standard.",
  },
  {
    question: "What are typical spreads?",
    answer: "From 0.4 points on major indices.",
  },
  {
    question: "What are the trading hours?",
    answer: "See instrument table for local session times.",
  },
  {
    question: "What leverage is available?",
    answer: "Up to 1:1000* — subject to regulatory limits and instrument.",
  },
]

export default function IndicesPage() {
  const [instruments, setInstruments] = useState([])
  const [chartSymbol, setChartSymbol] = useState("DJ:DJI")

  useEffect(() => {
    fetch("/api/markets/indices/instruments")
      .then((res) => res.json())
      .then((data) => setInstruments(data.instruments))
      .catch(console.error)
  }, [])

  const handleLoadChart = useCallback((symbol) => {
    const symbolMap = {
      "US30": "DJ:DJI",
      "US500": "SP:SPX",
      "USTEC": "NASDAQ:NDX",
      "DAXEUR": "XETR:DAX",
      "UK100": "CURRENCYCOM:UK100",
      "FRA40": "EURONEXT:PX1",
      "JP225": "INDEX:NKY",
      "AUS200": "PEPPERSTONE:AUS200",
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
        headline="Trade Global Indices with Precision"
        subhead="20+ major equity indices with tight spreads, deep liquidity and institutional-grade execution."
        ctaPrimary="Trade Indices"
        ctaSecondary="See Instruments"
      />

      <PlatformBlurb />

      <StatsBanner stats={stats} />

      <div id="live-chart">
        <TradingViewChart
          title="Live Indices Chart — Default US30"
          defaultSymbol={chartSymbol}
          quickSymbols={quickSymbols}
        />
      </div>

      <InstrumentTable
        title="Indices Instruments & Specifications"
        description="Access global equity indices including US30, US500, DAX40, FTSE100 and more. Click any row to load it on the chart."
        instruments={instruments}
        onLoadChart={handleLoadChart}
      />

      <WhatIsSection
        title="What is Indices Trading?"
        content="Indices track the performance of a selected basket of stocks. Trading indices provides exposure to broad market moves without buying individual equities."
      />

      <BenefitsGrid
        title="Why Trade Indices on VXNESS"
        benefits={benefits}
      />

      <FAQAccordion faqs={faqs} />

      <CTABar
        title="Ready to trade indices?"
        description="Open an account today and access 20+ global equity indices."
        ctaText="Open Account"
      />

      <Footer />
    </main>
  )
}
