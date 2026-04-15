
import { Link } from 'react-router-dom'
import { Navbar } from "@/components/landing/navbar"
import { Footer } from "@/components/landing/footer"
import { ArrowRight } from "lucide-react"

const blogPosts = [
  { title: "Understanding Forex Market Hours", category: "Education", date: "Mar 5, 2026", image: "/images/blog-1.jpg", slug: "forex-market-hours" },
  { title: "Top 5 Risk Management Strategies", category: "Trading Tips", date: "Mar 3, 2026", image: "/images/blog-2.jpg", slug: "risk-management" },
  { title: "Introduction to CFD Trading", category: "Education", date: "Feb 28, 2026", image: "/images/blog-3.jpg", slug: "cfd-trading-intro" },
  { title: "How to Read Candlestick Patterns", category: "Technical Analysis", date: "Feb 25, 2026", image: "/images/blog-4.jpg", slug: "candlestick-patterns" },
  { title: "The Impact of Economic News on Markets", category: "Market Analysis", date: "Feb 20, 2026", image: "/images/blog-5.jpg", slug: "economic-news-impact" },
  { title: "Building a Trading Plan", category: "Trading Tips", date: "Feb 15, 2026", image: "/images/blog-6.jpg", slug: "trading-plan" },
]

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main>
        <section className="pt-32 pb-12 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Blog</h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Market insights, trading education, and the latest updates from VXNESS.
            </p>
          </div>
        </section>

        <section className="py-12 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogPosts.map((post, i) => (
                <Link key={i} href={`/blog/${post.slug}`} className="group bg-white border border-border rounded-2xl overflow-hidden hover:shadow-xl transition-all">
                  <div className="relative h-48 bg-muted">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      <span className="text-4xl font-bold opacity-20">{i + 1}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">{post.category}</span>
                      <span className="text-xs text-muted-foreground">{post.date}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">{post.title}</h3>
                    <div className="flex items-center text-primary text-sm font-medium">
                      Read More <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </Link>
              ))}
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
