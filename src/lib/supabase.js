import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// If the keys are missing, don't crash to a blank page —
// use a placeholder and let the app show a clear warning banner.
export const configOk = Boolean(url && key)
export const supabase = createClient(
  url || 'https://not-configured.supabase.co',
  key || 'not-configured'
)

export const STATUS_LABELS = { scheduled: 'Scheduled', in_progress: 'In progress', on_hold: 'On hold', complete: 'Complete' }

export function makeAccessCode(company) {
  const prefix = (company || 'FC').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'FC'
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`
}

export function cleanCode(v) {
  return (v || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)
}

export function fmtStamp(iso) {
  const d = new Date(iso)
  return d.toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Turn database errors into a plain-English message we can show on screen
export function friendlyError(error, what) {
  if (!error) return ''
  if (!configOk) return 'App is not connected yet — the Supabase keys are missing in Vercel.'
  if (error.code === '23505') return 'That code is already in use — pick another.'
  if (error.code === '42P01' || (error.message || '').includes('does not exist') || (error.message || '').includes('schema cache'))
    return 'Database tables are missing — run the setup SQL in Supabase (SQL Editor).'
  if (error.code === '42501' || (error.message || '').toLowerCase().includes('row-level security'))
    return 'Database permissions are blocking this — re-run the setup SQL in Supabase.'
  if ((error.message || '').includes('Failed to fetch'))
    return 'Cannot reach the database — check your internet or the Supabase URL in Vercel.'
  return `${what || 'Save'} failed: ${error.message || 'unknown error'}`
}

export async function uploadPhotos(jobId, files, onProgress) {
  const urls = []
  let i = 0
  for (const file of files) {
    i++
    onProgress?.(`Uploading photo ${i} of ${files.length}…`)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('job-photos').upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}
