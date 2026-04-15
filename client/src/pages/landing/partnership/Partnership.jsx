
import { useState } from "react"
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { Input } from "@/components/landing/ui/input"
import { Checkbox } from "@/components/landing/ui/checkbox"
import { BecomePartnerDialog, TalkToTeamDialog } from "@/components/landing/auth-dialogs"
import { 
  ArrowRight, 
  Users, 
  CheckCircle2, 
  DollarSign, 
  Shield, 
  BarChart3, 
  LineChart, 
  Megaphone, 
  CreditCard, 
  HeadphonesIcon, 
  Infinity,
  ClipboardList,
  Share2,
  Wallet,
  Award
} from "lucide-react"

export default function PartnershipPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    phone: "",
    privacyAccepted: false,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    // Handle form submission
    console.log("Form submitted:", formData)
  }

  return (
    <>
      <Navbar />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          <img src="/images/partnership-hero.jpg"
            alt="Partnership"
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-2xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Earn With Every Trader
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Join a competitive affiliate sales program offering transparent commissions, dedicated support, and access to a Mauritius-regulated multi-asset broker.
              </p>
              
              <div className="grid sm:grid-cols-2 gap-4 mb-10">
                {[
                  "Volume-Based Commissions",
                  "Real-Time Partner Dashboard",
                  "Multi-Asset Offering",
                  "Monthly Commission Payouts",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-white/90">{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <BecomePartnerDialog
                  trigger={
                    <Button size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
                      Become a Partner
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  }
                />
                <TalkToTeamDialog
                  trigger={
                    <Button size="lg" className="bg-white hover:bg-white/90 text-deep-blue px-8 py-6 text-base font-semibold">
                      Talk to Our Team
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </section>

        {/* Who Should Join Section */}
        <section className="py-20 lg:py-28 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Who Should Join This Program</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Built for Growth-Focused Partners</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  image: "/images/partner-content-creator.jpg",
                  title: "Financial Content Creators",
                  description: "Bloggers, YouTubers, and social media influencers producing forex, trading, or investment education content for engaged audiences.",
                },
                {
                  image: "/images/partner-trading-community.jpg",
                  title: "Trading Communities & Forums",
                  description: "Discord servers, Telegram channels, and trading forums with active member bases seeking professional broker partnerships.",
                },
                {
                  image: "/images/partner-introducing-broker.jpg",
                  title: "Introducing Brokers & Agents",
                  description: "Licensed intermediaries, regional representatives, and independent agents with established client networks interested in multi-asset offerings.",
                },
              ].map((partner, index) => (
                <div
                  key={index}
                  className="group bg-white border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="relative h-56 overflow-hidden">
                    <img src={partner.image}
                      alt={partner.title}
                      
                      className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-foreground mb-3">{partner.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{partner.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3-Step Earning Process */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <img src="/images/bg-stats-fintech.jpg"
            alt=""
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/80 to-black/85" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Start Earning in Three Steps</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Simple. Transparent. Scalable.</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              {[
                {
                  icon: ClipboardList,
                  step: "01",
                  title: "Register Partnership",
                  description: "Complete the online application form with your website details, traffic sources, and promotional methods.",
                },
                {
                  icon: Share2,
                  step: "02",
                  title: "Promote VXNESS",
                  description: "Share your unique referral link via content, banners, landing pages, and direct recommendations.",
                },
                {
                  icon: Wallet,
                  step: "03",
                  title: "Earn Commissions",
                  description: "Receive regular payouts based on referred client activity and trading volume.",
                },
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 hover:bg-white/15 transition-all duration-300">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center">
                        <item.icon className="w-8 h-8 text-primary" />
                      </div>
                      <span className="text-5xl font-bold text-white/20">{item.step}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                    <p className="text-white/70 leading-relaxed">{item.description}</p>
                  </div>
                  {index < 2 && (
                    <div className="hidden md:block absolute top-1/2 -right-6 lg:-right-8 transform -translate-y-1/2">
                      <ArrowRight className="w-6 h-6 text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What Sets Us Apart - Benefits Grid */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <img src="/images/partnership-benefits-bg.jpg"
            alt=""
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/85 to-black/90" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">What Sets Our Partnership Apart</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Competitive Advantage for Long-Term Growth</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: DollarSign,
                  title: "Competitive Rebate Structure",
                  description: "Earn volume-based commissions up to $15 per lot with transparent calculation and no hidden caps.",
                },
                {
                  icon: Shield,
                  title: "Regulated Broker Reputation",
                  description: "Partner with a Mauritius FSC-licensed Investment Dealer maintaining segregated client funds.",
                },
                {
                  icon: BarChart3,
                  title: "Multi-Asset Product Range",
                  description: "Promote 60+ forex pairs, indices, metals, commodities, stocks, and futures through MT5.",
                },
                {
                  icon: LineChart,
                  title: "Real-Time Tracking Dashboard",
                  description: "Monitor referrals, activity, conversions, and earnings 24/7 via secure partner portal.",
                },
                {
                  icon: Megaphone,
                  title: "Marketing Resources Provided",
                  description: "Access professionally designed banners, landing pages, and email templates optimized for conversion.",
                },
                {
                  icon: CreditCard,
                  title: "Timely Commission Payments",
                  description: "Monthly settlements via bank transfer, e-wallets, or crypto with transparent processing.",
                },
                {
                  icon: HeadphonesIcon,
                  title: "Dedicated Partner Managers",
                  description: "Assigned relationship managers offering campaign guidance and optimization support.",
                },
                {
                  icon: Infinity,
                  title: "Lifetime Revenue Share",
                  description: "Earn recurring commissions from referred clients' trading activity indefinitely.",
                },
              ].map((benefit, index) => (
                <div
                  key={index}
                  className="group p-6 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl hover:bg-white/15 hover:border-primary/50 transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
                    <benefit.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact / Lead Form Section */}
        <section className="py-20 lg:py-28 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <p className="text-primary font-semibold text-sm uppercase tracking-wider mb-3">Partner Application</p>
                <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">Talk to Our Team</h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                  Discover how our bespoke liquidity and multi-asset services can help you scale your revenue. Fill out the form and our partnership team will reach out within 24 hours.
                </p>
                
                <div className="space-y-4">
                  {[
                    "Personalized commission structures",
                    "Dedicated account manager",
                    "Marketing support & resources",
                    "Fast onboarding process",
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border rounded-2xl p-8 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                        First Name
                      </label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                        className="h-12"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                        Last Name
                      </label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-foreground mb-2">
                      Company
                    </label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="h-12"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                      Phone Number
                    </label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-12"
                    />
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="privacy"
                      checked={formData.privacyAccepted}
                      onCheckedChange={(checked) => setFormData({ ...formData, privacyAccepted: checked })}
                      required
                    />
                    <label htmlFor="privacy" className="text-sm text-muted-foreground leading-relaxed">
                      I have read and understood the Privacy Policy
                    </label>
                  </div>

                  <Button type="submit" size="lg" className="w-full bg-primary hover:bg-primary/90 text-white py-6">
                    Submit Partnership Request
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Industry Recognition Section */}
        <section className="py-16 lg:py-20 bg-background border-y border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Recognized Across Global Markets</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { year: "2020", award: "Fastest Growing Forex Broker" },
                { year: "2021", award: "Best Customer Service" },
                { year: "2022", award: "Best Affiliate Program" },
                { year: "2023", award: "Best Broker Customer Satisfaction" },
              ].map((item, index) => (
                <div
                  key={index}
                  className="group p-6 bg-white border border-border rounded-2xl text-center hover:shadow-lg hover:border-primary/30 transition-all duration-300"
                >
                  <Award className="w-12 h-12 text-primary mx-auto mb-4 group-hover:scale-110 transition-transform" />
                  <p className="text-2xl font-bold text-foreground mb-2">{item.year}</p>
                  <p className="text-muted-foreground text-sm">{item.award}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA Section */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <img src="/images/bg-hero-fintech.jpg"
            alt=""
            
            className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/90" />
          
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">
              Ready to Build Long-Term Revenue?
            </h2>
            <p className="text-white/90 text-lg mb-10 max-w-2xl mx-auto">
              Partner with a regulated, multi-asset broker and scale your audience into recurring income.
            </p>
            <BecomePartnerDialog
              trigger={
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-10 py-6 text-base font-semibold">
                  Become a Partner Today
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
