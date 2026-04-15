
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { 
  ArrowRight, 
  Target, 
  Shield, 
  Zap, 
  Users, 
  BarChart3, 
  CreditCard, 
  Settings, 
  TrendingUp,
  LineChart,
  Layers,
  CheckCircle2,
  Monitor,
  Award
} from "lucide-react"
import { OpenAccountDialog } from "@/components/landing/auth-dialogs"

export default function PropFirmPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          <img src="/images/bg-hero-fintech.jpg"
            alt="Prop Firm"
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-3xl">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-4">VXNESS Prop Firm</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Empowering Modern Trading Businesses
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Launch, manage, and scale a professional proprietary trading firm with our powerful and scalable infrastructure. From challenge management to trader funding systems — everything on one unified platform.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-10">
                {[
                  "Challenge Management",
                  "Trader Funding Systems",
                  "Advanced Analytics",
                  "Complete Infrastructure",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-white/90">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <OpenAccountDialog
                  trigger={
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-6 sm:px-8 py-4 sm:py-6 text-base font-semibold w-full sm:w-auto">
                      Get Started
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  }
                />
                <Button size="lg" className="bg-white hover:bg-white/90 text-deep-blue px-6 sm:px-8 py-4 sm:py-6 text-base font-semibold w-full sm:w-auto">
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Overview Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Overview</p>
                <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
                  Complete Ecosystem for Prop Trading
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  VXNESS Prop Firm is designed to empower modern trading businesses with a powerful and scalable proprietary trading infrastructure. Our platform provides everything needed to launch, manage, and scale a professional prop trading firm with ease.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  From challenge management to trader funding systems, VXNESS offers a complete ecosystem that connects technology, capital, and traders on one unified platform. Whether you are launching a new prop firm or expanding an existing operation, VXNESS delivers the tools and infrastructure required for growth.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-video sm:aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl">
                  <img src="/images/dashboad.png"
                    alt="Prop Firm Dashboard"
                    
                    className="object-cover rounded-xl shadow-2xl" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What We Stand For */}
        <section className="py-20 lg:py-28 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Our Mission</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">What We Stand For</h2>
              <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                At VXNESS, our mission is to build a transparent, efficient, and technology-driven environment for proprietary trading firms.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Zap, title: "Performance", description: "High-speed execution and optimized systems for maximum efficiency." },
                { icon: Shield, title: "Security", description: "Enterprise-grade security protecting all data and transactions." },
                { icon: Layers, title: "Scalability", description: "Infrastructure that grows with your business needs." },
                { icon: Settings, title: "Simplicity", description: "Intuitive tools that simplify complex operations." },
              ].map((item, index) => (
                <div key={index} className="bg-white border border-border rounded-2xl p-6 hover:shadow-lg transition-all duration-300">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-muted-foreground mt-12 max-w-2xl mx-auto">
              VXNESS stands for innovation, stability, and empowering financial businesses through advanced trading technology.
            </p>
          </div>
        </section>

        {/* Empowering Traders */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <img src="/images/bg-stats-fintech.jpg"
            alt=""
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-black/85" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Technology & Capital</p>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                  Empowering Traders with Technology & Capital
                </h2>
                <p className="text-white/80 text-lg leading-relaxed mb-6">
                  VXNESS bridges the gap between talented traders and institutional-level infrastructure.
                </p>
                <p className="text-white/70 leading-relaxed mb-8">
                  Our system enables firms to provide traders with structured evaluation programs, automated funding processes, and professional trading tools. With advanced dashboards, risk management systems, and real-time data integration, VXNESS ensures traders and firms operate within a secure and efficient ecosystem.
                </p>
                <div className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>By combining cutting-edge technology with capital access, VXNESS creates new opportunities for traders to grow and scale.</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "10K+", label: "Active Traders" },
                  { value: "$50M+", label: "Funded Capital" },
                  { value: "99.9%", label: "Uptime" },
                  { value: "24/7", label: "Support" },
                ].map((stat, index) => (
                  <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 text-center">
                    <p className="text-3xl lg:text-4xl font-bold text-primary mb-2">{stat.value}</p>
                    <p className="text-white/70 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* One Platform Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Unified Platform</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">One Platform. Infinite Possibilities.</h2>
              <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                VXNESS provides a unified environment where all prop firm operations can be managed from a single platform. This centralized system reduces operational complexity and allows firms to focus on growth and trader performance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Users, title: "User Management", description: "Complete control over trader accounts, permissions, and profiles." },
                { icon: Target, title: "Challenge Programs", description: "Create and manage structured evaluation challenges with custom rules." },
                { icon: CreditCard, title: "Payment Processing", description: "Handle purchases, fees, and payouts with integrated payment systems." },
                { icon: BarChart3, title: "Analytics & Reporting", description: "Real-time insights into trader performance and business metrics." },
                { icon: TrendingUp, title: "Trading Integrations", description: "Seamless connections with trading platforms and data providers." },
                { icon: Monitor, title: "Admin Dashboard", description: "Powerful administrative tools for complete operational control." },
              ].map((feature, index) => (
                <div key={index} className="group bg-white border border-border rounded-2xl p-6 hover:shadow-xl hover:border-primary/30 transition-all duration-300">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* All-in-One Solution */}
        <section className="py-20 lg:py-28 bg-foreground">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Complete Solution</p>
                <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
                  All-in-One Trading Solution
                </h2>
                <p className="text-white/80 text-lg leading-relaxed mb-6">
                  VXNESS delivers a comprehensive technology stack designed specifically for proprietary trading firms.
                </p>
                <div className="space-y-4">
                  {[
                    "Advanced trader dashboards",
                    "Challenge evaluation systems",
                    "Integrated trading charts",
                    "Automated payment management",
                    "Administrative control panels",
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-white/70 mt-6">
                  The platform is designed to handle high volumes of traders while maintaining performance and reliability.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-square sm:aspect-[16/9] rounded-2xl overflow-hidden">
                  <img src="/images/trading.png"
                    alt="Trading Platform"
                    
                    className="object-cover rounded-xl shadow-2xl" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Complete Infrastructure */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Infrastructure</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Complete Prop Trading Infrastructure</h2>
              <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                VXNESS provides a fully integrated infrastructure required to operate a professional prop trading firm. Every component works together seamlessly to ensure smooth operations for both administrators and traders.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Trader Onboarding", description: "Streamlined registration and verification processes for new traders." },
                { title: "Challenge Management", description: "Create, monitor, and manage evaluation challenges with custom parameters." },
                { title: "Payment Processing", description: "Secure handling of deposits, fees, and profit payouts." },
                { title: "Analytics Dashboard", description: "Comprehensive insights into performance metrics and business KPIs." },
                { title: "CRM Tools", description: "Manage trader relationships and communications effectively." },
                { title: "Risk Monitoring", description: "Real-time risk assessment and automated rule enforcement." },
              ].map((item, index) => (
                <div key={index} className="bg-muted/50 border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>

            <p className="text-center text-muted-foreground mt-10 max-w-2xl mx-auto">
              This infrastructure allows firms to launch quickly, manage thousands of users, and scale their business globally.
            </p>
          </div>
        </section>

        {/* Charting Solutions */}
        <section className="py-20 lg:py-28 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Charting Technology</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Professional Charting Solutions</h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* BlackTrader */}
              <div className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="relative h-48 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                  <LineChart className="w-20 h-20 text-primary" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-3">Chart by BlackTrader</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    VXNESS integrates advanced charting technology powered by BlackTrader to deliver fast, responsive, and data-rich market analysis tools.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Real-time Charts", "Multiple Indicators", "Customizable Layouts", "Professional Grade"].map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* TradingView */}
              <div className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="relative h-48 bg-gradient-to-br from-blue-900 to-blue-800 flex items-center justify-center">
                  <BarChart3 className="w-20 h-20 text-primary" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-3">Chart by TradingView</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    VXNESS also supports TradingView integration, providing traders with one of the most trusted charting solutions in the financial industry.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["Technical Indicators", "Drawing Tools", "Multi-timeframe", "Powerful Interface"].map((tag, i) => (
                      <span key={i} className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Management Solution */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Admin Tools</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Complete Prop Firm Management Solution</h2>
              <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
                VXNESS provides a centralized management system that allows administrators to control every aspect of their prop firm operations. With a dedicated admin dashboard and intelligent reporting systems, firms gain complete visibility and control.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Challenge Users */}
              <div className="bg-white border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Challenge Users</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  VXNESS enables firms to create and manage structured evaluation challenges for traders.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Administrators can define rules, profit targets, drawdown limits, and evaluation phases to ensure traders meet specific performance criteria before receiving funded accounts. The system automatically tracks trader activity and monitors rule compliance in real time.
                </p>
              </div>

              {/* Manage Payments */}
              <div className="bg-white border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Manage Purchase & Payments</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  VXNESS includes a secure payment management system that allows firms to handle trader purchases, challenge fees, and payout processes efficiently.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The platform supports multiple payment gateways and provides detailed transaction tracking, automated billing systems, and financial reporting tools. This ensures smooth financial operations and transparency for both firms and traders.
                </p>
              </div>

              {/* Challenge Programs */}
              <div className="bg-white border border-border rounded-2xl p-8 hover:shadow-xl transition-all duration-300">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Award className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Challenge Programs</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  VXNESS allows prop firms to design customized challenge programs based on their business model.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Firms can create different account sizes, evaluation stages, profit targets, and trading conditions. These programs can be fully managed from the admin panel, giving firms the flexibility to adapt their offerings as the market evolves.
                </p>
              </div>
            </div>

            <p className="text-center text-muted-foreground mt-10 max-w-2xl mx-auto">
              The result is a scalable and flexible challenge ecosystem tailored for modern proprietary trading firms.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <img src="/images/bg-hero-fintech.jpg"
            alt=""
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/90" />
          
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Ready to Launch Your Prop Firm?
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-2xl mx-auto">
              Get started with VXNESS and build a professional proprietary trading business with our complete infrastructure.
            </p>
            <OpenAccountDialog
              trigger={
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-10 py-6 text-base font-semibold">
                  Get Started Today
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              }
            />
          </div>
        </section>

        {/* Risk Disclaimer */}
        <section className="py-8 bg-foreground">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-white/60 text-xs text-center leading-relaxed">
              <strong className="text-white/80">Risk Warning:</strong> CFDs are complex instruments and carry a high risk due to leverage. Ensure you understand the risks before participating. Your capital is at risk.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
