
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function TermsAndConditionsPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Terms and Conditions</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-6">By accessing and using VXNESS services, you agree to be bound by these Terms and Conditions.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Eligibility</h2>
            <p className="text-muted-foreground mb-6">You must be at least 18 years old and legally able to enter into contracts to use our services.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground mb-6">You agree to provide accurate information during registration and maintain the security of your account credentials.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Trading Services</h2>
            <p className="text-muted-foreground mb-6">Our trading services are provided on an "as is" basis. We do not guarantee profits or specific outcomes.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Fees and Charges</h2>
            <p className="text-muted-foreground mb-6">You agree to pay all applicable fees, spreads, and charges associated with your trading activities.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">VXNESS shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.</p>
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
