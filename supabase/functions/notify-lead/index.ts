// Supabase Edge Function — notify-lead
// Accepts form submissions, inserts lead via direct Postgres connection
// (bypasses PostgREST entirely — avoids Content-Type security check),
// then sends notification email via Resend.

import { Pool } from 'https://deno.land/x/postgres@v0.19.3/mod.ts'

const RESEND_API_URL = 'https://api.resend.com/emails'
const NOTIFY_TO      = 'samuel@elamamarketing.com'
const NOTIFY_FROM    = 'leads@elamamarketing.com'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  let body: Record<string, string>
  try {
    body = await req.json() as Record<string, string>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const name     = (body.name     ?? '').trim()
  const email    = (body.email    ?? '').trim()
  const company  = (body.company  ?? '').trim() || null
  const interest = (body.interest ?? '').trim() || null
  const message  = (body.message  ?? '').trim() || null

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  // ---- Direct Postgres insert (bypasses PostgREST + Content-Type check) ----
  const pool = new Pool(Deno.env.get('SUPABASE_DB_URL')!, 1, true)
  let lead: { id: string; created_at: string }

  try {
    const conn = await pool.connect()
    try {
      const result = await conn.queryObject<{ id: string; created_at: string }>`
        INSERT INTO leads (name, email, company, interest, message)
        VALUES (${name}, ${email}, ${company}, ${interest}, ${message})
        RETURNING id, created_at
      `
      lead = result.rows[0]
      console.log('[notify-lead] Lead inserted:', lead.id)
    } finally {
      conn.release()
    }
  } catch (err) {
    console.error('[notify-lead] DB insert error:', err)
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } finally {
    await pool.end()
  }

  // ---- Send email via Resend ----
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    const submittedAt   = new Date(lead.created_at).toLocaleString('en-GB', {
      timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short',
    })
    const interestLabel = formatInterest(interest)

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8" /><title>New Lead</title></head>
      <body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,system-ui,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:#1B2A4A;padding:32px 40px;">
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#ffffff;">Elama<span style="color:#C9A84C;">Consulting</span></p>
                  <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.6);letter-spacing:0.08em;text-transform:uppercase;">New Lead Notification</p>
                </td>
              </tr>
              <tr>
                <td style="padding:36px 40px;">
                  <p style="margin:0 0 24px;font-size:16px;color:#374151;">You have a new enquiry from your website:</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    ${row('Name', name)}
                    ${row('Email', `<a href="mailto:${email}" style="color:#1B2A4A;font-weight:600;">${email}</a>`)}
                    ${company      ? row('Company',       company)            : ''}
                    ${interestLabel ? row('Interested in', interestLabel)     : ''}
                    ${message      ? row('Message',        message, true)     : ''}
                    ${row('Submitted', submittedAt)}
                  </table>
                  <div style="margin:32px 0 0;text-align:center;">
                    <a href="mailto:${email}?subject=Re: Your Elama Consulting Enquiry&body=Hi ${name},"
                       style="display:inline-block;background:#C9A84C;color:#1B2A4A;font-weight:700;font-size:15px;padding:14px 32px;border-radius:6px;text-decoration:none;">
                      Reply to ${name.split(' ')[0]}
                    </a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;">Elama Consulting · elamamarketing.com · Lead ID: ${lead.id.slice(0, 8)}</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `

    const resendRes = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `Elama Consulting <${NOTIFY_FROM}>`,
        to:      [NOTIFY_TO],
        subject: `New lead: ${name}${company ? ` (${company})` : ''}`,
        html:    emailHtml,
        text:    `New lead\n\nName: ${name}\nEmail: ${email}\nCompany: ${company ?? 'N/A'}\nInterest: ${interestLabel ?? 'N/A'}\nMessage: ${message ?? 'N/A'}\nDate: ${submittedAt}`,
      }),
    })

    if (!resendRes.ok) {
      console.error('[notify-lead] Resend error:', await resendRes.text())
    } else {
      console.log('[notify-lead] Email sent for lead:', lead.id)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})

function formatInterest(interest: string | null): string | null {
  if (!interest) return null
  const map: Record<string, string> = {
    coaching: 'Executive Coaching',
    benefits: 'PCMP Health Benefits',
    both:     'Both — Executive Coaching & PCMP Health Benefits',
  }
  return map[interest] ?? interest
}

function row(label: string, value: string, multiline = false): string {
  return `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 16px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;width:130px;vertical-align:top;background:#f9fafb;">${label}</td>
      <td style="padding:12px 16px;font-size:14px;color:#111827;${multiline ? 'white-space:pre-wrap;' : ''}">${value}</td>
    </tr>
  `
}
