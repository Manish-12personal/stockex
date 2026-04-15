
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function RiskDisclosurePage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Risk Disclosure</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-semibold text-yellow-800 mb-2">Important Warning</h2>
              <p className="text-yellow-700">Trading CFDs and Forex involves significant risk of loss. You should carefully consider whether trading is suitable for you in light of your circumstances, knowledge, and financial resources.</p>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. High Risk Investment</h2>
            <p className="text-muted-foreground mb-6">CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Between 74-89% of retail investor accounts lose money when trading CFDs.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Leverage Risk</h2>
            <p className="text-muted-foreground mb-6">Leverage can work against you as well as for you. Leverage magnifies both gains and losses.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Market Risk</h2>
            <p className="text-muted-foreground mb-6">Markets can be volatile and prices can move rapidly against your position, resulting in losses.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. No Guarantee of Profits</h2>
            <p className="text-muted-foreground mb-6">Past performance is not indicative of future results. There is no guarantee that you will make profits or avoid losses.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Seek Independent Advice</h2>
            <p className="text-muted-foreground">You should seek independent financial advice if you do not fully understand the risks involved.</p>
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
