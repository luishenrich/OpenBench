// Fixture mode serves contract/fixtures instead of calling /api, so the dashboard works before the
// backend does. Default: on in `npm run dev`, off in the production build. Override with
// ?fixtures=1 or ?fixtures=0 (remembered in this browser).

function read(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('fixtures')
    if (q === '1' || q === '0') localStorage.setItem('biy:fixtures', q)
    const stored = localStorage.getItem('biy:fixtures')
    if (stored === '1' || stored === '0') return stored === '1'
  } catch {
    // storage blocked: fall through to the default
  }
  return import.meta.env.DEV
}

export const FIXTURES = read()
