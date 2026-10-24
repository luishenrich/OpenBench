import { api } from '@/lib/api'
import { FIXTURES } from '@/lib/mode'
import { supabase } from '@/lib/supabase'
import type { Case } from '@/types'

export const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX_MB = 20

/** A plain-words reason the file can't be used, or null. */
export function rejectReason(file: File): string | null {
  if (!EXT[file.type]) return 'Only PNG, JPEG, WebP or PDF files.'
  if (file.size > MAX_MB * 1024 * 1024) return `Larger than ${MAX_MB} MB.`
  return null
}

/**
 * Stores the file in the Supabase bucket "cases" (<workspace_id>/<use_case_id>/<uuid>.<ext>) with the signed-in
 * user's session, then adds one case with the public URL. In fixture mode the file stays in the browser.
 */
export async function uploadCase(file: File, ids: { workspaceId: string; useCaseId: string }, reference: string | null): Promise<Case> {
  let url: string
  if (FIXTURES) {
    url = URL.createObjectURL(file)
  } else {
    if (!supabase) throw new Error('Uploads need Supabase, and it is not configured here.')
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) throw new Error('Sign in to upload files.')
    const path = `${ids.workspaceId}/${ids.useCaseId}/${crypto.randomUUID()}.${EXT[file.type]}`
    const { error } = await supabase.storage.from('cases').upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    url = supabase.storage.from('cases').getPublicUrl(path).data.publicUrl
  }
  const [created] = await api.addCases(ids.useCaseId, [{
    input: { images: [url], vars: {} },
    reference: reference?.trim() ? parseReference(reference) : null,
    source: 'upload',
    tags: ['uploaded'],
  }])
  return created
}

// JSON if it parses, else the text as written
function parseReference(text: string): unknown {
  try { return JSON.parse(text) } catch { return text.trim() }
}

/**
 * Pasted examples: a JSON array of {vars} / {messages} objects, or plain text with one example per block
 * (blocks separated by a blank line), each sent as {vars: {input}}.
 */
export function parseExamples(text: string): { cases: { input: { vars?: Record<string, unknown>; messages?: unknown[] } }[]; error: string | null } {
  const t = text.trim()
  if (!t) return { cases: [], error: null }
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t)
      if (!Array.isArray(arr)) return { cases: [], error: 'Expected a JSON array.' }
      const cases = arr.map((x) => {
        if (x && typeof x === 'object' && !Array.isArray(x)) return 'vars' in x || 'messages' in x ? { input: x } : { input: { vars: x } }
        return { input: { vars: { input: x } } }
      })
      return { cases, error: null }
    } catch {
      return { cases: [], error: 'That looks like JSON but does not parse. Check the brackets and quotes.' }
    }
  }
  return { cases: t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => ({ input: { vars: { input: b } } })), error: null }
}
