// Vercel serverless function — AI drafts a professional client field report
// Requires ANTHROPIC_API_KEY set in Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel.' })
  }
  try {
    const { job, notes, reference_urls, today_images } = req.body || {}
    const j = job || {}

    const content = []
    const refs = Array.isArray(reference_urls) ? reference_urls.slice(0, 3) : []
    for (const url of refs) {
      content.push({ type: 'image', source: { type: 'url', url } })
    }
    const todays = Array.isArray(today_images) ? today_images.slice(0, 3) : []
    for (const img of todays) {
      if (img && img.data) {
        content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type || 'image/jpeg', data: img.data } })
      }
    }
    content.push({
      type: 'text',
      text:
`You are the field reporting assistant for Tradelec LLC, a transformer field services company. Write today's client-facing field report.

JOB INFO
- Job: ${j.title || 'n/a'}
- Customer: ${j.customer || 'n/a'}
- Site: ${j.site || 'n/a'}
- Status: ${j.status || 'n/a'}
- Scope of work: ${j.scope || 'n/a'}
- Planned daily tasks: ${j.daily_tasks || 'n/a'}

TECHNICIAN'S ROUGH NOTES FROM TODAY:
${notes || '(none provided — base the report on the scope and daily tasks in progress)'}

${refs.length > 0 ? `The first ${refs.length} attached image(s) are JOB REFERENCE FILES (may include the transformer nameplate, drawings, or the project schedule). If a nameplate is legible, include key equipment data (manufacturer, serial, kV class, MVA). If a schedule is legible, note progress against it.` : ''}
${todays.length > 0 ? `The last ${todays.length} attached image(s) are PHOTOS TAKEN TODAY ON SITE. Describe the visible completed work accurately in WORK COMPLETED TODAY, and use them as evidence when marking checklist items complete. Never claim something is done that neither the notes nor the photos support.` : ''}

Write a professional, client-friendly daily field report. Requirements:
- Plain text only, no markdown symbols (#, *, -). Use short paragraphs and simple line breaks. Section labels in CAPS followed by a colon are fine.
- Sections: WORK COMPLETED TODAY, EQUIPMENT (only if nameplate data is available), FINDINGS / OBSERVATIONS (if any), NEXT STEPS.
- If the planned daily tasks are formatted as a checklist (lines starting with [ ] or [x]), also include a DAILY CHECKLIST section listing every task, marking each line [x] if the technician's notes indicate it was completed and [ ] if not. Do not drop tasks and do not mark anything complete unless the notes support it.
- Clear and confident, no jargon the customer would not know, no invented facts — only what the notes, scope, tasks, and images support.
- Keep it under 250 words.

Respond with ONLY a JSON object, no markdown fences, exactly: {"headline":"short report title with today's focus","report":"the full report text with \\n line breaks"}`
    })

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content }]
      })
    })

    const data = await r.json()
    if (data.error) return res.status(500).json({ error: data.error.message || 'AI request failed.' })
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json({
      headline: parsed.headline || 'Daily field report',
      report: parsed.report || ''
    })
  } catch (err) {
    return res.status(500).json({ error: 'Could not write the report. Try again.' })
  }
}
