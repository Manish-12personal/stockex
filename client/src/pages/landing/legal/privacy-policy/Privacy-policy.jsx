
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function PrivacyPolicyPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray max-w-none">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
            <p className="text-muted-foreground mb-6">We collect information you provide directly to us, including personal identification information, contact details, and financial information necessary for account opening and trading activities.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-6">We use the information we collect to provide, maintain, and improve our services, process transactions, send communications, and comply with legal obligations.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Information Sharing</h2>
            <p className="text-muted-foreground mb-6">We do not sell or rent your personal information to third parties. We may share information with service providers, regulatory authorities, and as required by law.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Data Security</h2>
            <p className="text-muted-foreground mb-6">We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Your Rights</h2>
            <p className="text-muted-foreground mb-6">You have the right to access, correct, or delete your personal information. Contact us to exercise these rights.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Contact Us</h2>
            <p className="text-muted-foreground">For questions about this Privacy Policy, please contact us at privacy@vxness.com.</p>
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
