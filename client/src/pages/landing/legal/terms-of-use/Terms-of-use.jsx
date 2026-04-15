
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function TermsOfUsePage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Terms of Use</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Website Use</h2>
            <p className="text-muted-foreground mb-6">By using this website, you agree to these Terms of Use. If you do not agree, please do not use our website.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Intellectual Property</h2>
            <p className="text-muted-foreground mb-6">All content on this website is owned by VXNESS and protected by intellectual property laws. You may not reproduce or distribute content without permission.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-6">You may not use this website for any unlawful purpose, to transmit harmful code, or to interfere with the website's operation.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Disclaimer</h2>
            <p className="text-muted-foreground mb-6">Information on this website is for general purposes only and does not constitute financial advice.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Changes to Terms</h2>
            <p className="text-muted-foreground">We may update these Terms of Use at any time. Continued use of the website constitutes acceptance of updated terms.</p>
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
