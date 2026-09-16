// Vercel serverless function — reads a receipt photo with Claude
// Requires ANTHROPIC_API_KEY set in Vercel (Settings -> Environment Variables)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
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
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: 'This is a purchase receipt. Extract the merchant/store name, the final total amount paid (a number, no currency symbol), the purchase date if visible (YYYY-MM-DD), and a very short summary of what was bought (a few words). Respond with ONLY a JSON object, no markdown, in exactly this shape: {"vendor":"...","amount":0.00,"date":"YYYY-MM-DD or null","summary":"..."}. If you cannot read a field, use null for it.'
            }
          ]
        }]
      })
    })

    const data = await r.json()
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'AI request failed.' })
    }
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json({
      vendor: parsed.vendor || null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : parseFloat(parsed.amount) || null,
      date: parsed.date || null,
      summary: parsed.summary || null
    })
  } catch (err) {
    return res.status(500).json({ error: 'Could not read the receipt.' })
  }
}
