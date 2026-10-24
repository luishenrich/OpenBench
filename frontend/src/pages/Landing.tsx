import Catalogue from '@/components/landing/Catalogue'
import Connect from '@/components/landing/Connect'
import ExampleResult from '@/components/landing/ExampleResult'
import Footer from '@/components/landing/Footer'
import { Hero, Nav } from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'

// Page-scoped motion: the hero copy rises in.
// index.css switches all animation off under prefers-reduced-motion.
const css = `
@keyframes lp-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.lp-rise { animation: lp-rise 700ms cubic-bezier(.2,.7,.2,1) both; }
`

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-bg [&_dd]:text-pretty [&_h2]:text-balance [&_h3]:text-balance [&_li]:text-pretty [&_p]:text-pretty">
      <style>{css}</style>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <ExampleResult />
        <Catalogue />
        <Connect />
      </main>
      <Footer />
    </div>
  )
}
