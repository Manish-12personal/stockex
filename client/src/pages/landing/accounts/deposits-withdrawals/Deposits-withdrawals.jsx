import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { MarketHero } from "@/components/landing/markets/market-hero"
import { TradingViewChart } from "@/components/landing/markets/tradingview-chart"
import { FAQAccordion } from "@/components/landing/markets/faq-accordion"
import { PaymentMethodsTable } from "@/components/landing/accounts/payment-methods-table"
import { FundingSteps } from "@/components/landing/accounts/funding-steps"
import { WithdrawalProcess } from "@/components/landing/accounts/withdrawal-process"
import { FundingBenefits } from "@/components/landing/accounts/funding-benefits"

const quickSymbols = [
  { symbol: "OANDA:XAUUSD", label: "XAU/USD" },
  { symbol: "CAPITALCOM:US30", label: "US30" },
  { symbol: "FX:EURUSD", label: "EUR/USD" },
  { symbol: "BITSTAMP:BTCUSD", label: "BTC/USD" },
]

const faqs = [
  {
    question: "What is the minimum deposit?",
    answer: "$100 or currency equivalent. This allows you to start trading with a manageable amount while accessing all platform features.",
  },
  {
    question: "How long do withdrawals take?",
    answer: "Withdrawals are typically processed within 24 hours. Bank transfers may take 1-3 additional business days depending on your bank. E-wallet withdrawals are usually instant once approved.",
  },
  {
    question: "Are there any fees?",
    answer: "We charge no deposit fees. Withdrawal fees may vary by payment provider, but we cover most standard withdrawal methods. Check the payment methods table for specific details.",
  },
  {
    question: "Why must I withdraw to my deposit source?",
    answer: "This is a standard AML (Anti-Money Laundering) and security compliance requirement. Funds must be returned to the original payment method to prevent fraud and ensure account security.",
  },
  {
    question: "Can I use cryptocurrency for deposits?",
    answer: "Cryptocurrency deposits are coming soon. We are working on integrating major cryptocurrencies to provide more funding options for our clients.",
  },
]

export default function DepositsWithdrawalsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      <MarketHero
        headline="Seamless Funding Solutions"
        subhead="Access secure deposit and withdrawal methods with transparent processing times, multi-currency support, and zero deposit fees."
        ctaPrimary="Fund Account"
        ctaSecondary="Withdraw Funds"
      />

      <TradingViewChart
        title="Live Market Conditions"
        defaultSymbol="OANDA:XAUUSD"
        quickSymbols={quickSymbols}
      />

      <PaymentMethodsTable />

      <FundingSteps />

      <WithdrawalProcess />

      <FundingBenefits />

      <FAQAccordion title="Common Payment Questions" faqs={faqs} />

      <Footer />
    </main>
  )
}
