import { Navbar } from "@/components/landing/navbar"
import { HeroSection } from "@/components/hero-section"
import { MarketAccessSection } from "@/components/market-access-section"
import { PricingTableSection } from "@/components/pricing-table-section"
import { EconomicCalendarSection } from "@/components/economic-calendar-section"
import { PipCalculatorSection } from "@/components/pip-calculator-section"
import { StepsSection } from "@/components/steps-section"
import { PlatformSection } from "@/components/platform-section"
import { CapitalSection } from "@/components/capital-section"
import { PartnershipSection } from "@/components/partnership-section"
import { FeaturesSection } from "@/components/features-section"
import { SocialTradingSection } from "@/components/social-trading-section"
import { AwardsSection } from "@/components/awards-section"
import { SupportSection } from "@/components/support-section"
import { MobileAppSection } from "@/components/mobile-app-section"
import { Footer } from "@/components/landing/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <MarketAccessSection />
      <PricingTableSection />
      <EconomicCalendarSection />
      <PipCalculatorSection />
      <StepsSection />
      <PlatformSection />
      <CapitalSection />
      <PartnershipSection />
      <FeaturesSection />
      <SocialTradingSection />
      <AwardsSection />
      <SupportSection />
      <MobileAppSection />
      <Footer />
    </main>
  )
}
