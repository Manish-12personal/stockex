
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { ArrowRight } from "lucide-react"
import { OpenAccountDialog } from "@/components/landing/auth-dialogs"

export default function HeatmapPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="relative min-h-[60vh] flex items-center overflow-hidden">
          <img src="/images/bg-hero-fintech.jpg" alt="Heatmap"  className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-3xl">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-4">Market Tools</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Heatmap Analysis
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Visualize market movements at a glance with our interactive heatmap tool.
              </p>
              <OpenAccountDialog trigger={<Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6">Start Trading <ArrowRight className="w-5 h-5 ml-2" /></Button>} />
            </div>
          </div>
        </section>

        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-foreground mb-6">Coming Soon</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our advanced heatmap analysis tool is currently under development. Stay tuned for real-time market visualization across all asset classes.
            </p>
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
