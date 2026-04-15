
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
  Droplets, 
  Wheat,
  TrendingUp,
  Shield
} from "lucide-react"

const stats = [
  { value: "15+", label: "Commodities" },
  { value: "0.03", label: "Spreads from (energy)" },
  { value: "1:1000", label: "Leverage up to*" },
  { value: "24/5", label: "Market Access" },
]

const quickSymbols = [
  { symbol: "TVC:UKOIL", label: "Brent" },
  { symbol: "TVC:USOIL", label: "WTI" },
  { symbol: "NYMEX:NG1!", label: "Natural Gas" },
  { symbol: "CBOT:ZW1!", label: "Wheat" },
]

const benefits = [
  {
    icon: Droplets,
    title: "Energy Markets",
    description: "Trade Brent, WTI crude oil and natural gas with tight spreads.",
  },
  {
    icon: Wheat,
    title: "Agricultural Commodities",
    description: "Access wheat, corn, soybeans, coffee and more agricultural products.",
  },
  {
    icon: TrendingUp,
    title: "Diversification",
    description: "Add commodities to your portfolio as an inflation hedge.",
  },
  {
    icon: Shield,
    title: "Tight Execution",
    description: "Trade liquid contracts with competitive execution.",
  },
]

const faqs = [
  {
    question: "What is the minimum deposit?",
    answer: "$100 standard.",
  },
  {
    question: "What are typical spreads?",
    answer: "Dependent on market — energy spreads can be extremely tight during liquid hours.",
  },
  {
    question: "What commodities are available?",
    answer: "Crude oil (Brent & WTI), natural gas, coffee, wheat, corn, soybeans, sugar and more.",
  },
  {
    question: "What leverage is available?",
    answer: "Up to 1:1000* — subject to regulatory limits and instrument.",
  },
]

export default function CommoditiesPage() {
  const [instruments, setInstruments] = useState([])
  const [chartSymbol, setChartSymbol] = useState("TVC:UKOIL")

  useEffect(() => {
    fetch("/api/markets/commodities/instruments")
      .then((res) => res.json())
      .then((data) => setInstruments(data.instruments))
      .catch(console.error)
  }, [])

  const handleLoadChart = useCallback((symbol) => {
    const symbolMap = {
      "UKOIL": "TVC:UKOIL",
      "USOIL": "TVC:USOIL",
      "NATGAS": "NYMEX:NG1!",
      "COFFEE": "ICEUS:KC1!",
      "WHEAT": "CBOT:ZW1!",
      "CORN": "CBOT:ZC1!",
      "SOYBEAN": "CBOT:ZS1!",
      "SUGAR": "NYMEX:SB1!",
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
        headline="Trade Global Commodities with Confidence"
        subhead="Energy and agricultural markets including Brent, WTI, Natural Gas, Coffee and more — backed by regulated CFD execution."
        ctaPrimary="View Commodities"
        ctaSecondary="Trade Now"
      />

      <PlatformBlurb />

      <StatsBanner stats={stats} />

      <div id="live-chart">
        <TradingViewChart
          title="Live Commodities Chart — Default UKOIL (Brent)"
          defaultSymbol={chartSymbol}
          quickSymbols={quickSymbols}
        />
      </div>

      <InstrumentTable
        title="Commodities Instruments & Specifications"
        description="Explore energy and agricultural commodities with flexible contract specifications. Click any row to load it on the chart."
        instruments={instruments}
        onLoadChart={handleLoadChart}
      />

      <WhatIsSection
        title="What is Commodities Trading?"
        content="Commodities trading lets investors access raw materials markets affected by supply/demand, geopolitics, and seasonal cycles. CFDs allow participation without delivery obligations."
      />

      <BenefitsGrid
        title="Benefits of Commodities Trading"
        benefits={benefits}
      />

      <FAQAccordion faqs={faqs} />

      <CTABar
        title="Ready to trade commodities?"
        description="Open an account today and access energy and agricultural markets."
        ctaText="Open Account"
      />

      <Footer />
    </main>
  )
}
