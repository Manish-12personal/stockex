import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { FileText } from "lucide-react"

export default function TermsConditions() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-yellow-accent" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Terms & Conditions
          </h1>
          <p className="text-lg text-white/70">
            Last updated: March 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-bold text-deep-blue mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-6">
              By accessing or using STOCKEX trading platform and services, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">2. Eligibility</h2>
            <p className="text-muted-foreground mb-4">To use our services, you must:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Be at least 18 years of age</li>
              <li>Be a resident of India</li>
              <li>Have a valid PAN card</li>
              <li>Complete KYC verification</li>
              <li>Have a valid bank account in your name</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground mb-6">
              You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. STOCKEX is not liable for any loss arising from unauthorized access to your account.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">4. Trading Services</h2>
            <p className="text-muted-foreground mb-4">Our platform provides access to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Equity trading (NSE, BSE)</li>
              <li>Derivatives trading (Futures & Options)</li>
              <li>Commodity trading (MCX)</li>
              <li>Currency trading</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">5. Fees and Charges</h2>
            <p className="text-muted-foreground mb-6">
              All applicable fees, brokerage charges, taxes, and other charges will be clearly disclosed before you execute any trade. You agree to pay all charges associated with your trading activities.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">6. Risk Disclosure</h2>
            <p className="text-muted-foreground mb-6">
              Trading in financial markets involves substantial risk. You acknowledge that you understand the risks involved and that past performance is not indicative of future results. You should only trade with money you can afford to lose.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">7. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Engage in market manipulation or insider trading</li>
              <li>Use the platform for money laundering</li>
              <li>Attempt to hack or disrupt our systems</li>
              <li>Provide false information</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-6">
              STOCKEX shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of our services, including but not limited to trading losses, system failures, or data loss.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">9. Governing Law</h2>
            <p className="text-muted-foreground mb-6">
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">10. Contact Information</h2>
            <p className="text-muted-foreground mb-6">
              For questions about these Terms, contact us at:<br />
              Email: legal@stockex.com<br />
              Phone: 1800-XXX-XXXX
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
