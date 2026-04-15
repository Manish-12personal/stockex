
import { Button } from "@/components/landing/ui/button"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { 
  Download, 
  ArrowRight, 
  Star, 
  Quote,
  Eye,
  Target,
  Shield,
  Clock,
  Lightbulb,
  TrendingUp,
  BarChart3,
  Smartphone,
  Monitor
} from "lucide-react"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-24 lg:pt-32 pb-20 lg:pb-28 overflow-hidden">
        <img src="/images/about-hero.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/60" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Built for Ambitious Traders
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8 leading-relaxed">
              Eone Capital Limited delivers regulated forex and CFD trading infrastructure under Mauritius FSC oversight, empowering professional traders across global financial markets since 2017.
            </p>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
              <Download className="w-5 h-5 mr-2" />
              Download Platform
            </Button>
          </div>
        </div>
      </section>

      {/* Company History Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/about-history.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold mb-3 uppercase tracking-wider text-sm">Eight Years of Evolution</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              From Startup to Global Trading Infrastructure
            </h2>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-white/80 text-lg leading-relaxed mb-6">
                Founded in 2017, Eone Capital Limited began with a clear mission: Provide retail traders access to institutional-grade execution without compromise.
              </p>
              <p className="text-white/80 leading-relaxed mb-6">
                Starting as a Mauritius-regulated forex broker, the company expanded into multi-asset CFD trading including:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                {["Forex", "Indices", "Commodities", "Metals", "Stocks", "Futures"].map((asset) => (
                  <div key={asset} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 text-center">
                    <span className="text-white font-medium">{asset}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-white/80 leading-relaxed mb-6">
                Through continuous investment in:
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "MetaTrader 5 infrastructure",
                  "ECN connectivity",
                  "Liquidity aggregation systems"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/80">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-white/80 leading-relaxed mb-6">
                Eonefx evolved into a trusted trading partner serving over <span className="text-white font-semibold">4 million registered clients</span> worldwide.
              </p>
              <p className="text-white/90 leading-relaxed font-medium">
                Today, we are entering our most ambitious phase — redefining trader engagement, product innovation, and global accessibility for 2026 and beyond.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Client Reviews Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/bg-stats-fintech.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold mb-3 uppercase tracking-wider text-sm">What Traders Say About Us</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-2">Excellent</h2>
            <p className="text-white/70">Based on <span className="text-white font-semibold">7,983 Reviews</span></p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {[
              "Excellent feedback",
              "Fast withdrawals",
              "Reliable platform",
              "Professional support"
            ].map((item) => (
              <div key={item} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 mx-auto mb-2" />
                <span className="text-white/90 text-sm">{item}</span>
              </div>
            ))}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              "Great and fast withdrawal. I'm impressed with the speed and transparency.",
              "Excellent broker experience with reliable execution.",
              "Everything works smoothly and professionally."
            ].map((review, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <Quote className="w-8 h-8 text-primary/50 mb-4" />
                <p className="text-white/90 italic mb-4">&ldquo;{review}&rdquo;</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <p className="text-center text-white/50 text-sm mt-8">Showing verified 4 & 5 star reviews.</p>
        </div>
      </section>

      {/* Vision & Mission Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/about-vision.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold mb-3 uppercase tracking-wider text-sm">Beyond Trading, We Build Trust</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 lg:p-10">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
              <p className="text-white/80 leading-relaxed">
                To become the preferred institutional gateway for professional traders seeking reliable execution, deep liquidity, and regulatory transparency — where technology meets ambition across global markets.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 lg:p-10">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
              <p className="text-white/80 leading-relaxed">
                Deliver robust trading infrastructure, segregated fund protection, and continuous trader education while maintaining regulatory compliance, technological innovation, and community-driven growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/bg-benefits-fintech.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-primary font-semibold mb-3 uppercase tracking-wider text-sm">What Drives Us</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white">Our Core Values</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Transparency",
                description: "Clear pricing structures, execution statistics, and regulatory disclosures ensure verifiable operational standards and institutional-grade reporting."
              },
              {
                icon: Clock,
                title: "Reliability",
                description: "Consistent platform uptime, segregated banking custody, and 24/5 multilingual support provide dependable infrastructure for traders worldwide."
              },
              {
                icon: Lightbulb,
                title: "Innovation",
                description: "Continuous upgrades in trading technology, liquidity networks, and educational resources drive enhanced trader performance across asset classes."
              }
            ].map((value, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center hover:bg-white/15 transition-colors">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{value.title}</h3>
                <p className="text-white/70 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform & Technology Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/bg-chart-fintech.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-primary font-semibold mb-3 uppercase tracking-wider text-sm">Platform & Technology</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                MetaTrader 5 Platform
              </h2>
              <p className="text-white/80 text-lg leading-relaxed mb-8">
                Access institutional trading through the industry-recognized MetaTrader 5 platform with:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { icon: BarChart3, text: "Advanced charting tools" },
                  { icon: TrendingUp, text: "Algorithmic trading capabilities" },
                  { icon: Target, text: "Multi-asset execution" },
                  { icon: Smartphone, text: "Desktop & mobile access" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4">
                    <feature.icon className="w-5 h-5 text-primary" />
                    <span className="text-white/90">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-72 h-56 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center">
                  <Monitor className="w-24 h-24 text-primary/50" />
                </div>
                <div className="absolute -bottom-6 -right-6 w-20 h-36 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-primary/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Awards Section */}
      <section id="awards" className="py-20 lg:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Recognition</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Industry Awards</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Recognized for excellence in trading services and innovation.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { year: "2023", award: "Best Forex Broker Mauritius", issuer: "Global Finance Awards" },
              { year: "2022", award: "Most Transparent Broker", issuer: "Finance Magnates" },
              { year: "2021", award: "Best Trading Platform", issuer: "World Finance Awards" },
              { year: "2020", award: "Fastest Growing Broker", issuer: "European CEO Awards" },
              { year: "2019", award: "Best Customer Service", issuer: "International Finance Awards" },
              { year: "2018", award: "Most Reliable Broker", issuer: "Global Banking & Finance Review" },
              { year: "2017", award: "Best New Broker", issuer: "UK Forex Awards" },
              { year: "2016", award: "Innovation in Trading", issuer: "FinTech Awards" },
            ].map((item, index) => (
              <div key={index} className="bg-white border border-border rounded-2xl p-6 text-center hover:shadow-lg transition-all">
                <div className="text-3xl font-bold text-primary mb-2">{item.year}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{item.award}</h3>
                <p className="text-sm text-muted-foreground">{item.issuer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulation Section */}
      <section id="regulation" className="py-20 lg:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Compliance</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Regulatory Information</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Fully regulated and authorized to provide trading services globally.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div className="bg-white border border-border rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">Mauritius FSC</h3>
                  <p className="text-muted-foreground">Financial Services Commission</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-1">License Number</p>
                  <p className="text-foreground font-mono">GB21026358</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Regulated Activities</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Dealing in securities as a principal</li>
                    <li>• Underwriting as a principal</li>
                    <li>• Advising on securities</li>
                    <li>• Asset management</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl p-8">
              <h3 className="text-xl font-bold text-foreground mb-4">Client Fund Protection</h3>
              <div className="space-y-4">
                {[
                  { title: "Segregated Accounts", desc: "Client funds are held in separate bank accounts from company funds." },
                  { title: "Negative Balance Protection", desc: "Clients cannot lose more than their account balance." },
                  { title: "Compensation Scheme", desc: "Participation in investor compensation schemes where applicable." },
                  { title: "Regular Audits", desc: "Annual audits by independent firms ensure compliance." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <img src="/images/bg-hero-fintech.jpg"
          alt=""
          
          className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/85 to-black/90" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
            Join the Next Chapter of Trading Excellence
          </h2>
          <p className="text-white/80 text-lg mb-10">
            Experience regulated infrastructure, transparent execution, and global market access.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
              Open Account
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" className="bg-white hover:bg-white/90 text-deep-blue px-8 py-6 text-base font-semibold">
              <Download className="w-5 h-5 mr-2" />
              Download Platform
            </Button>
          </div>
        </div>
      </section>

      {/* Risk Warning */}
      <section className="bg-foreground py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-white/60 text-sm leading-relaxed">
            <span className="text-white/80 font-semibold">Risk Warning:</span> CFDs are complex instruments and carry a high risk due to leverage. Ensure you understand the risks before trading. <span className="text-white/80 font-medium">Your capital is at risk.</span>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
