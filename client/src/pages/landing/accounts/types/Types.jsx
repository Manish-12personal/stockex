import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { MarketHero } from "@/components/landing/markets/market-hero"
import { StatsBanner } from "@/components/landing/markets/stats-banner"
import { TradingViewChart } from "@/components/landing/markets/tradingview-chart"
import { FAQAccordion } from "@/components/landing/markets/faq-accordion"
import { AccountTypesGrid } from "@/components/landing/accounts/account-types-grid"
import { AccountComparisonTable } from "@/components/landing/accounts/account-comparison-table"
import { AccountAdvantages } from "@/components/landing/accounts/account-advantages"

const stats = [
  { value: "250", suffix: "+", label: "CFD Assets" },
  { value: "2", suffix: "%", label: "Max Interest on Balance" },
  { value: "1:2000", label: "Dynamic Leverage" },
  { value: "24", suffix: "/5", label: "World-Class Support" },
]

const quickSymbols = [
  { symbol: "FX:EURUSD", label: "EUR/USD" },
  { symbol: "FX:GBPUSD", label: "GBP/USD" },
  { symbol: "OANDA:XAUUSD", label: "XAU/USD" },
  { symbol: "CAPITALCOM:US30", label: "US30" },
]

const faqs = [
  {
    question: "Which account is best for beginners?",
    answer: "The Standard Account is ideal for beginners with a $100 minimum deposit and zero commission structure. It provides balanced features and full platform access while you learn the markets.",
  },
  {
    question: "What makes Zero Spread different?",
    answer: "Zero Spread accounts offer a zero markup pricing model with a transparent commission structure. This is ideal for high-volume traders who prefer predictable costs and institutional-grade execution.",
  },
  {
    question: "Can I open multiple account types?",
    answer: "Yes, clients can hold multiple account types simultaneously. This allows you to use different accounts for different trading strategies or to test various conditions.",
  },
  {
    question: "What leverage is available?",
    answer: "Leverage up to 1:1000* is available depending on the instrument and your account equity. Dynamic leverage adjusts based on position size and market conditions for optimal risk management.",
  },
  {
    question: "How do I upgrade my account type?",
    answer: "You can upgrade your account type through the client portal or by contacting support. Some upgrades may require meeting minimum deposit requirements.",
  },
]

export default function AccountTypesPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      <MarketHero
        headline="Choose Your Trading Account"
        subhead="Select from Standard, Pro, RAW, or Zero Spread accounts with transparent pricing, dynamic leverage up to 1:1000*, and access to the award-winning MT5 platform tailored to your experience level."
        ctaPrimary="Open Account"
        ctaSecondary="Compare Accounts"
      />

      <StatsBanner stats={stats} />

      <TradingViewChart
        title="Live Market Overview"
        defaultSymbol="FX:EURUSD"
        quickSymbols={quickSymbols}
      />

      <AccountTypesGrid />

      <AccountComparisonTable />

      <AccountAdvantages />

      <FAQAccordion faqs={faqs} />

      <Footer />
    </main>
  )
}
