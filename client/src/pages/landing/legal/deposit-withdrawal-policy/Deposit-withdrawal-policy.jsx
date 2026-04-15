
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"

export default function DepositWithdrawalPolicyPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Deposit & Withdrawal Policy</h1>
            <p className="text-muted-foreground">Last updated: March 2026</p>
          </div>
        </section>
        <section className="py-12 bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Deposits</h2>
            <p className="text-muted-foreground mb-6">We accept deposits via bank transfer, credit/debit cards, and approved e-wallets. Deposits are typically processed within 1-3 business days.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Minimum Deposit</h2>
            <p className="text-muted-foreground mb-6">The minimum deposit amount varies by account type. Please refer to our Account Types page for specific requirements.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Withdrawals</h2>
            <p className="text-muted-foreground mb-6">Withdrawal requests are processed within 1-5 business days. Funds will be returned to the original payment method where possible.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Fees</h2>
            <p className="text-muted-foreground mb-6">VXNESS does not charge deposit fees. Withdrawal fees may apply depending on the payment method and amount.</p>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Verification</h2>
            <p className="text-muted-foreground">For security purposes, we may require identity verification before processing withdrawals.</p>
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
