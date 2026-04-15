import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { Building2, Users, BarChart3, Shield, Headphones, TrendingUp, Check, ArrowRight } from "lucide-react"

const benefits = [
  {
    icon: Building2,
    title: "White-Label Platform",
    description: "Get your own branded trading platform with full customization options. Your brand, your identity.",
  },
  {
    icon: Users,
    title: "Client Management",
    description: "Powerful dashboard to manage all your clients, track their activity, and monitor performance.",
  },
  {
    icon: BarChart3,
    title: "Revenue Sharing",
    description: "Attractive revenue sharing model with transparent reporting and timely payouts.",
  },
  {
    icon: Shield,
    title: "Risk Management",
    description: "Advanced risk management tools to protect your business and your clients.",
  },
  {
    icon: Headphones,
    title: "Dedicated Support",
    description: "Personal account manager and 24/7 technical support for you and your clients.",
  },
  {
    icon: TrendingUp,
    title: "Marketing Support",
    description: "Marketing materials, landing pages, and promotional tools to grow your business.",
  },
]

const features = [
  "Complete white-label trading solution",
  "Multi-asset trading (Stocks, Indices, Commodities, Currency)",
  "Real-time market data feeds",
  "Advanced trading platform",
  "Client onboarding system",
  "Back-office management",
  "Compliance and regulatory support",
  "Payment gateway integration",
  "Mobile trading apps",
  "API access for custom integrations",
  "Training and certification",
  "Performance analytics dashboard",
]

const plans = [
  {
    name: "Starter",
    description: "Perfect for new brokers starting their journey",
    features: ["Up to 100 clients", "Basic platform customization", "Email support", "Standard reports"],
  },
  {
    name: "Professional",
    description: "For growing brokerages with expanding client base",
    features: ["Up to 500 clients", "Full platform customization", "Priority support", "Advanced analytics", "Marketing tools"],
    featured: true,
  },
  {
    name: "Enterprise",
    description: "For established brokerages with high volume",
    features: ["Unlimited clients", "Complete white-label", "Dedicated account manager", "Custom integrations", "Premium support"],
  },
]

export default function BrokerProgram() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-accent/20 text-yellow-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Building2 className="w-4 h-4" />
            Broker Partnership
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Start Your Own Brokerage Business
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8">
            Launch your brokerage with our white-label solution. Get everything you need to run a successful trading business in India.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold px-8 py-6 text-lg">
              Apply Now
            </Button>
            <Button className="bg-white hover:bg-white/90 text-deep-blue font-semibold px-8 py-6 text-lg">
              Schedule a Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-blue mb-4">
              Why Partner with STOCKEX?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We provide everything you need to launch and grow your brokerage business.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white border border-border rounded-2xl p-8 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-deep-blue mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-20 bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-deep-blue mb-6">
                Complete Brokerage Solution
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Our broker program includes everything you need to run a professional brokerage business. From technology to compliance, we've got you covered.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-profit-green flex-shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 border border-border shadow-lg">
              <h3 className="text-2xl font-bold text-deep-blue mb-6">Get Started Today</h3>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                  <input type="text" className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="Enter your name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email Address</label>
                  <input type="email" className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="Enter your email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
                  <input type="tel" className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="+91 XXXXX XXXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Company Name (Optional)</label>
                  <input type="text" className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" placeholder="Your company name" />
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white py-6">
                  Submit Application
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-blue mb-4">
              Partnership Plans
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the plan that fits your business needs
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index} 
                className={`bg-white rounded-2xl p-8 transition-all duration-300 ${
                  plan.featured 
                    ? "border-2 border-yellow-accent shadow-xl scale-105" 
                    : "border border-border hover:shadow-lg"
                }`}
              >
                {plan.featured && (
                  <div className="text-yellow-600 text-sm font-bold mb-4">MOST POPULAR</div>
                )}
                <h3 className="text-2xl font-bold text-deep-blue mb-2">{plan.name}</h3>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-profit-green" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.featured 
                      ? "bg-yellow-accent hover:bg-yellow-500 text-deep-blue" 
                      : "bg-primary hover:bg-primary/90 text-white"
                  }`}
                >
                  Contact Sales
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
