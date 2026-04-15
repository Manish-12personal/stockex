import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { Button } from "@/components/landing/ui/button"
import { Briefcase, MapPin, Clock, Users, Zap, Heart, Award, ArrowRight } from "lucide-react"
import { TalkToTeamDialog } from "@/components/landing/auth-dialogs"

const benefits = [
  { icon: Heart, title: "Health Insurance", desc: "Comprehensive medical coverage for you and family" },
  { icon: Zap, title: "Fast Growth", desc: "Accelerated career growth opportunities" },
  { icon: Users, title: "Great Team", desc: "Work with talented professionals" },
  { icon: Award, title: "Performance Bonus", desc: "Quarterly performance-based rewards" },
]

const openings = [
  {
    title: "Senior Frontend Developer",
    department: "Engineering",
    location: "Mumbai, India",
    type: "Full-time",
  },
  {
    title: "Backend Engineer",
    department: "Engineering",
    location: "Bangalore, India",
    type: "Full-time",
  },
  {
    title: "Product Manager",
    department: "Product",
    location: "Mumbai, India",
    type: "Full-time",
  },
  {
    title: "UI/UX Designer",
    department: "Design",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Customer Support Executive",
    department: "Support",
    location: "Mumbai, India",
    type: "Full-time",
  },
  {
    title: "Compliance Officer",
    department: "Legal",
    location: "Mumbai, India",
    type: "Full-time",
  },
]

export default function Careers() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20" style={{ background: 'linear-gradient(135deg, #0B3C6D 0%, #1A73E8 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            Join Our Team
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-8">
            Build the future of trading technology with us. We're looking for passionate individuals who want to make a difference.
          </p>
          <TalkToTeamDialog
            trigger={
              <Button size="lg" className="bg-yellow-accent hover:bg-yellow-500 text-deep-blue font-semibold px-8">
                View Open Positions
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            }
          />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-blue mb-4">Why Work With Us?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We offer competitive benefits and a great work environment.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-6 rounded-2xl border border-border hover:shadow-lg transition-shadow">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-deep-blue mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-20 bg-secondary/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-deep-blue mb-4">Open Positions</h2>
            <p className="text-lg text-muted-foreground">Find your perfect role at STOCKEX</p>
          </div>

          <div className="space-y-4">
            {openings.map((job, index) => (
              <TalkToTeamDialog
                key={index}
                trigger={
                  <div className="bg-white rounded-xl p-6 border border-border hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-deep-blue mb-2">{job.title}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {job.department}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {job.type}
                          </span>
                        </div>
                      </div>
                      <Button className="bg-primary hover:bg-primary/90 text-white">
                        Apply Now
                      </Button>
                    </div>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
