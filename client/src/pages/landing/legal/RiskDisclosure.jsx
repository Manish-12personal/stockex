import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { AlertTriangle } from "lucide-react"

export default function RiskDisclosure() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-yellow-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-yellow-accent" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Risk Disclosure
          </h1>
          <p className="text-lg text-white/70">
            Important information about trading risks
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Warning Box */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-6 mb-12">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-yellow-800 mb-2">Important Risk Warning</h3>
                <p className="text-yellow-700">
                  Trading in financial instruments involves substantial risk of loss and is not suitable for all investors. You should carefully consider whether trading is appropriate for you in light of your financial condition.
                </p>
              </div>
            </div>
          </div>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-bold text-deep-blue mb-4">1. General Risk Warning</h2>
            <p className="text-muted-foreground mb-6">
              Trading in stocks, derivatives, commodities, and currencies involves significant risk and can result in the loss of your invested capital. The high degree of leverage available in these markets can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">2. Market Risks</h2>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li><strong>Price Volatility:</strong> Market prices can fluctuate rapidly and unpredictably due to various factors including economic events, corporate announcements, and global developments.</li>
              <li><strong>Liquidity Risk:</strong> Some securities may have limited liquidity, making it difficult to execute trades at desired prices.</li>
              <li><strong>Gap Risk:</strong> Prices may gap significantly between trading sessions, potentially resulting in losses greater than anticipated.</li>
              <li><strong>Currency Risk:</strong> For currency trading, exchange rate fluctuations can affect the value of your investments.</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">3. Leverage and Margin Risks</h2>
            <p className="text-muted-foreground mb-6">
              Trading on margin allows you to control larger positions with a smaller amount of capital. While this can amplify profits, it can also amplify losses. You may lose more than your initial investment. Margin calls may require you to deposit additional funds or close positions at unfavorable prices.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">4. Derivatives Risks</h2>
            <p className="text-muted-foreground mb-4">Trading in futures and options carries additional risks:</p>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>Options may expire worthless, resulting in total loss of premium paid</li>
              <li>Futures contracts have expiry dates and may require physical delivery</li>
              <li>Complex derivative strategies may have unlimited loss potential</li>
              <li>Time decay affects options value</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">5. Technology Risks</h2>
            <ul className="list-disc pl-6 text-muted-foreground mb-6 space-y-2">
              <li>System failures or internet connectivity issues may prevent order execution</li>
              <li>Software bugs or errors may affect trading operations</li>
              <li>Cyber security threats may compromise account security</li>
              <li>Exchange system outages may halt trading</li>
            </ul>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">6. Regulatory Risks</h2>
            <p className="text-muted-foreground mb-6">
              Changes in laws, regulations, or exchange rules may affect your trading activities. Regulatory actions may result in trading halts, position limits, or other restrictions that could impact your ability to trade or close positions.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">7. No Guarantee of Profits</h2>
            <p className="text-muted-foreground mb-6">
              Past performance is not indicative of future results. There is no guarantee that any trading strategy or system will generate profits. You should not invest money that you cannot afford to lose.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">8. Seek Professional Advice</h2>
            <p className="text-muted-foreground mb-6">
              If you are unsure about the risks involved in trading, you should seek advice from an independent financial advisor. STOCKEX does not provide investment advice, and any information provided is for educational purposes only.
            </p>

            <h2 className="text-2xl font-bold text-deep-blue mb-4">9. Acknowledgment</h2>
            <p className="text-muted-foreground mb-6">
              By opening an account with STOCKEX, you acknowledge that you have read and understood this Risk Disclosure document and accept the risks associated with trading in financial markets.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
