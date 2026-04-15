
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function ConflictsOfInterestPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Conflicts of Interest Disclosure</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Overview</h2>
            <p className="text-muted-foreground mb-6">VXNESS is committed to identifying, managing, and disclosing conflicts of interest that may arise in the course of providing services to our clients.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Types of Conflicts</h2>
            <p className="text-muted-foreground mb-6">Conflicts may arise between VXNESS and clients, between different clients, or between employees and clients.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Management of Conflicts</h2>
            <p className="text-muted-foreground mb-6">We maintain policies and procedures to identify and manage conflicts of interest, including information barriers, independent oversight, and disclosure requirements.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Disclosure</h2>
            <p className="text-muted-foreground">Where conflicts cannot be adequately managed, we will disclose the nature of the conflict to affected clients.</p>
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
