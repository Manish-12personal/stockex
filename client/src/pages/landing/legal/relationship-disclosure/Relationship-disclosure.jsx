
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function RelationshipDisclosurePage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Relationship Disclosure</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Nature of Relationship</h2>
            <p className="text-muted-foreground mb-6">VXNESS acts as a principal in transactions with clients. We are the counterparty to your trades.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Services Provided</h2>
            <p className="text-muted-foreground mb-6">We provide execution-only services. We do not provide investment advice or portfolio management.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Client Classification</h2>
            <p className="text-muted-foreground mb-6">Clients are classified as retail or professional based on their experience, knowledge, and financial situation.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Regulatory Status</h2>
            <p className="text-muted-foreground">VXNESS is regulated by the Financial Services Commission (FSC) of Mauritius.</p>
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
