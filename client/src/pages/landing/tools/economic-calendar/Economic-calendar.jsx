
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { EconomicCalendarSection } from "@/components/economic-calendar-section"

export default function EconomicCalendarPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-8 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Economic Calendar</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Stay ahead of market-moving events with our live economic calendar.
            </p>
          </div>
        </section>
        <EconomicCalendarSection />
        <section className="py-8 bg-foreground">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-white/60 text-xs text-center">
              <strong className="text-white/80">Risk Warning:</strong> CFDs are complex instruments and carry a high risk due to leverage. Your capital is at risk.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
