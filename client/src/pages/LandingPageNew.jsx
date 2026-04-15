import { Navbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { LiveTicker } from "@/components/landing/live-ticker"
import { MarketAccessSection } from "@/components/landing/market-access-section"
import { PricingTableSection } from "@/components/landing/pricing-table-section"
import { EconomicCalendarSection } from "@/components/landing/economic-calendar-section"
import { TradingToolsSection } from "@/components/landing/trading-tools-section"
import { QuestionnaireSection } from "@/components/landing/questionnaire-section"
import { DemoTradingSection } from "@/components/landing/demo-trading-section"
import { AccountsSection } from "@/components/landing/accounts-section"
import { PlatformSection } from "@/components/landing/platform-section"
import { CapitalSection } from "@/components/landing/capital-section"
import { PartnershipSection } from "@/components/landing/partnership-section"
import { StatisticsSection } from "@/components/landing/statistics-section"
import { SupportSection } from "@/components/landing/support-section"
import { Footer } from "@/components/landing/footer"

export default function LandingPageNew() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <LiveTicker />
      <MarketAccessSection />
      <PricingTableSection />
      <EconomicCalendarSection />
      <TradingToolsSection />
      <QuestionnaireSection />
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
