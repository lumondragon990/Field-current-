import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

export const STATUS_LABELS = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  on_hold: 'On hold',
  complete: 'Complete'
}

export function makeAccessCode(company) {
  const prefix = (company || 'FC').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'FC'
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${num}`
}

export function fmtStamp(iso) {
  const d = new Date(iso)
  return d.toLocaleString([], {
    month: 'short', day: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export async function uploadPhotos(jobId, files, onProgress) {
  const urls = []
  let i = 0
  for (const file of files) {
    i++
    onProgress?.(`Uploading photo ${i} of ${files.length}…`)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('job-photos').upload(path, file, {
      cacheControl: '3600', upsert: false
    })
    if (error) throw error
    const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}
