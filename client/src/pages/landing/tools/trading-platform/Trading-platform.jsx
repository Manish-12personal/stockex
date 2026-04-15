
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { ArrowRight, Monitor, Smartphone, Download, CheckCircle2, Zap, Shield, BarChart3 } from "lucide-react"
import { OpenAccountDialog } from "@/components/landing/auth-dialogs"

export default function TradingPlatformPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="relative min-h-[70vh] flex items-center overflow-hidden">
          <img src="/images/bg-hero-fintech.jpg" alt="Trading Platform"  className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-3xl">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-4">Trading Platform</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                MetaTrader 5
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Trade on the world's most popular platform with advanced charting, automated trading, and professional tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <OpenAccountDialog trigger={<Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6">Get Started <ArrowRight className="w-5 h-5 ml-2" /></Button>} />
                <Button size="lg" className="bg-white hover:bg-white/90 text-deep-blue font-semibold px-8 py-6">
                  <Download className="w-5 h-5 mr-2" /> Download Platform
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Available on All Devices</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Trade anywhere, anytime with MT5 on desktop, web, and mobile.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Monitor, title: "Desktop", description: "Full-featured trading terminal for Windows and macOS." },
                { icon: Smartphone, title: "Mobile", description: "Trade on the go with iOS and Android apps." },
                { icon: BarChart3, title: "Web Terminal", description: "Access your account from any browser, no download required." },
              ].map((item, i) => (
                <div key={i} className="bg-white border border-border rounded-2xl p-8 text-center hover:shadow-lg transition-all">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <item.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">Why Choose MT5?</h2>
                <div className="space-y-4">
                  {[
                    "Advanced charting with 80+ technical indicators",
                    "Automated trading with Expert Advisors (EAs)",
                    "One-click trading and depth of market",
                    "Multi-asset trading: Forex, Stocks, Indices, Commodities",
                    "Economic calendar integration",
                    "Secure and reliable execution",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
                <img src="/images/mt5-platform.jpg" alt="MT5 Platform"  className="object-cover" />
              </div>
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
