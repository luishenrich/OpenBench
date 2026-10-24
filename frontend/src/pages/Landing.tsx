import Catalogue from '@/components/landing/Catalogue'
import Connect from '@/components/landing/Connect'
import ExampleResult from '@/components/landing/ExampleResult'
import Footer from '@/components/landing/Footer'
import { Hero, Nav } from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import '@/components/landing/landing.css'

// Page-scoped motion and light. Every "before" state is gated on prefers-reduced-motion: no-preference,
// so with motion reduced the page renders in its final state.
export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-bg [&_dd]:text-pretty [&_li]:text-pretty [&_p]:text-pretty">
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
