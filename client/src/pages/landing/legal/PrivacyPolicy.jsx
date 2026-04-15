import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Shield } from "lucide-react"

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-yellow-accent" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Privacy Policy
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
            <h2 className="text-2xl font-bold text-deep-blue mb-4">1. Introduction</h2>
            <p className="text-muted-foreground mb-6">
              STOCKEX ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our trading platform and services.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Personal identification information (name, email, phone number, PAN, Aadhaar)</li>
              <li>Financial information (bank account details, trading history)</li>
              <li>KYC documents and verification data</li>
              <li>Device and usage information</li>
              <li>Communication preferences</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">We use the collected information for:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Account creation and management</li>
              <li>Processing transactions and trades</li>
              <li>Regulatory compliance and KYC verification</li>
              <li>Customer support and communication</li>
              <li>Improving our services and user experience</li>
              <li>Fraud prevention and security</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">4. Data Security</h2>
            <p className="text-muted-foreground mb-6">
              We implement industry-standard security measures including encryption, secure servers, and regular security audits to protect your personal information. However, no method of transmission over the Internet is 100% secure.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">5. Data Sharing</h2>
            <p className="text-muted-foreground mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Regulatory authorities (SEBI, exchanges) as required by law</li>
              <li>Banking and payment partners for transaction processing</li>
              <li>Service providers who assist in our operations</li>
              <li>Legal authorities when required by law</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data (subject to regulatory requirements)</li>
              <li>Opt-out of marketing communications</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">7. Contact Us</h2>
            <p className="text-muted-foreground mb-6">
              If you have questions about this Privacy Policy, please contact us at:<br />
              Email: privacy@stockex.com<br />
              Phone: 1800-XXX-XXXX
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
