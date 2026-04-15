
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function RestrictedCountriesPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Restricted Countries</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-muted-foreground mb-8">VXNESS does not offer services to residents of the following countries and territories due to regulatory restrictions:</p>
            <div className="grid md:grid-cols-2 gap-4">
              {["United States", "North Korea", "Iran", "Syria", "Cuba", "Crimea Region", "Sudan", "Afghanistan", "Myanmar", "Venezuela", "Zimbabwe", "Belarus"].map((country, i) => (
                <div key={i} className="bg-muted/50 border border-border rounded-lg px-4 py-3">
                  <span className="text-foreground">{country}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-8">This list is not exhaustive and may be updated from time to time. If you are unsure whether our services are available in your jurisdiction, please contact us.</p>
          </div>
        </section>
        <section className="py-8 bg-foreground">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-white/60 text-xs text-center"><strong className="text-white/80">Risk Warning:</strong> CFDs are complex instruments and carry a high risk due to leverage. Your capital is at risk.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
