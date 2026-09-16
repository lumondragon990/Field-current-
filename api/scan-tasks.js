// Vercel serverless function — reads a task list / cronogram screenshot into a checklist
// Requires ANTHROPIC_API_KEY set in Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel.' })
  }
  try {
    const { image, media_type } = req.body || {}
    if (!image) return res.status(400).json({ error: 'No image received.' })

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image } },
            {
              type: 'text',
              text: `This image shows a list of daily job activities or tasks (it may be a screenshot of a schedule, a cronogram, a spreadsheet, or a written/printed task list) for a transformer field services job. Extract every task or activity you can read, in the order shown. Clean up abbreviations only when obvious; do not invent tasks that are not in the image. Format each task as its own line starting with "[ ] " (open checkbox). If tasks are grouped by day or phase, keep a plain-text heading line for the group (no checkbox on heading lines). Respond with ONLY a JSON object, no markdown fences, exactly: {"tasks":"the checklist as one string with \\n between lines","count":0}. If you cannot read any tasks, return {"tasks":"","count":0}.`
            }
          ]
        }]
      })
    })

    const data = await r.json()
    if (data.error) return res.status(500).json({ error: data.error.message || 'AI request failed.' })
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json({ tasks: parsed.tasks || '', count: parsed.count || 0 })
  } catch (err) {
    return res.status(500).json({ error: 'Could not read the task list. Try a clearer photo.' })
  }
}
