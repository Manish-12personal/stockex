import { Button } from "@/components/landing/ui/button"
import { Check, Monitor, Smartphone, Globe } from "lucide-react"
import { Link } from "react-router-dom"

const features = [
  "Advanced charts with technical indicators",
  "Real-time order execution",
  "Portfolio management tools",
  "Secure login with 2FA",
]

const platforms = [
  { icon: Globe, name: "Web", desc: "Trade from any browser" },
  { icon: Smartphone, name: "Mobile", desc: "iOS & Android apps" },
  { icon: Monitor, name: "Desktop", desc: "Windows & Mac" },
]

export function PlatformSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">Platform</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-blue mb-6 text-balance">
              Advanced STOCKEX Trading Platform
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Experience powerful trading technology designed for Indian markets with real-time data and seamless execution.
            </p>

            {/* Features List */}
            <ul className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-profit-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-profit-green" />
                  </div>
                  <span className="text-foreground font-medium">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Platform Options */}
            <div className="flex flex-wrap gap-4 mb-8">
              {platforms.map((platform, index) => (
                <div key={index} className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                  <platform.icon className="w-5 h-5 text-primary" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">{platform.name}</div>
                    <div className="text-xs text-muted-foreground">{platform.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <Link to="/login"><Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8">Access Platform</Button></Link>
          </div>

          {/* Right Content - App Preview */}
          <div className="relative">
            <div className="rounded-3xl shadow-2xl overflow-hidden">
              <img 
                src="/images/indices-1.jpg" 
                alt="STOCKEX Trading Platform" 
                className="w-full object-cover object-bottom"
                style={{ marginTop: '-60px' }}
              />
            </div>

            {/* Floating Badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 border border-border">
              <div className="w-10 h-10 bg-yellow-accent/20 rounded-full flex items-center justify-center">
                <span className="text-yellow-600 font-bold text-sm">SX</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-deep-blue">STOCKEX</div>
                <div className="text-xs text-muted-foreground">Web • Mobile • Desktop</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

