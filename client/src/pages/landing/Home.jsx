import { Navbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/hero-section"
import { LiveTicker } from "@/components/live-ticker"
import { MarketAccessSection } from "@/components/market-access-section"
import { PricingTableSection } from "@/components/pricing-table-section"
import { EconomicCalendarSection } from "@/components/economic-calendar-section"
import { TradingToolsSection } from "@/components/trading-tools-section"
import { DemoTradingSection } from "@/components/demo-trading-section"
import { AccountsSection } from "@/components/accounts-section"
import { PlatformSection } from "@/components/platform-section"
import { CapitalSection } from "@/components/capital-section"
import { PartnershipSection } from "@/components/partnership-section"
import { StatisticsSection } from "@/components/statistics-section"
import { SupportSection } from "@/components/support-section"
import { Footer } from "@/components/landing/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <LiveTicker />
      <MarketAccessSection />
      <PricingTableSection />
      <EconomicCalendarSection />
      <TradingToolsSection />
      <DemoTradingSection />
      <AccountsSection />
      <PlatformSection />
      <CapitalSection />
      <PartnershipSection />
      <StatisticsSection />
      <SupportSection />
      <Footer />
    </main>
  )
}
