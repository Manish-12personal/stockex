
import { Link } from 'react-router-dom'
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { FileText, ArrowRight } from "lucide-react"

const legalDocs = [
  { title: "Privacy Policy", href: "/legal/privacy-policy", description: "How we collect, use, and protect your personal information." },
  { title: "Terms and Conditions", href: "/legal/terms-and-conditions", description: "Terms governing your use of our services." },
  { title: "Risk Disclosure", href: "/legal/risk-disclosure", description: "Important information about the risks of trading." },
  { title: "Conflicts of Interest Disclosure", href: "/legal/conflicts-of-interest", description: "Our policy on managing conflicts of interest." },
  { title: "Deposit & Withdrawal Policy", href: "/legal/deposit-withdrawal-policy", description: "Policies regarding deposits and withdrawals." },
  { title: "Relationship Disclosure", href: "/legal/relationship-disclosure", description: "Information about our relationship with clients." },
  { title: "Restricted Countries", href: "/legal/restricted-countries", description: "List of countries where our services are not available." },
  { title: "Terms of Use", href: "/legal/terms-of-use", description: "Terms for using our website and platform." },
]

export default function LegalPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Legal Documents</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Important legal information and policies governing our services.
            </p>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-6">
              {legalDocs.map((doc, i) => (
                <Link key={i} href={doc.href} className="group bg-white border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{doc.title}</h3>
                      <p className="text-muted-foreground text-sm mb-3">{doc.description}</p>
                      <div className="flex items-center text-primary text-sm font-medium">
                        Read Document <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

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
