import { Smartphone, Building2, Shield, CreditCard } from "lucide-react"
import { DepositDialog } from "@/components/landing/auth-dialogs"

const features = [
  {
    icon: Smartphone,
    title: "Instant UPI deposits",
  },
  {
    icon: Building2,
    title: "Net banking support",
  },
  {
    icon: Shield,
    title: "Secure withdrawals",
  },
  {
    icon: CreditCard,
    title: "Multi-bank integration",
  },
]

export function CapitalSection() {
  return (
    <section className="py-20 lg:py-28 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Visual */}
          <div className="relative order-2 lg:order-1">
            <div className="bg-gradient-to-br from-primary/10 to-yellow-accent/10 rounded-3xl p-4 sm:p-8 lg:p-12">
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                {features.map((feature, index) => (
                  <DepositDialog
                    key={index}
                    trigger={
                      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow border border-border cursor-pointer">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                          <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-deep-blue">{feature.title}</p>
                      </div>
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Payments</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-blue mb-6 text-balance">
              Fast & Secure Transactions
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Deposit and withdraw funds instantly with India's most trusted payment methods. Zero deposit fees with same-day processing.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
