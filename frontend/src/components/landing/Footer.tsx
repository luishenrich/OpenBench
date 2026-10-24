import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Container } from './shared'

export default function Footer() {
  return (
    <footer className="py-12">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-sm text-faint">Benchmark It Yourself</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#metrics" className="hover:text-fg">Metrics</a>
          <a href="#connect" className="hover:text-fg">Connect</a>
          <Link to="/login" className="text-fg hover:text-white">Sign in</Link>
        </nav>
      </Container>
    </footer>
  )
}
