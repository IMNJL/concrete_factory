const express = require('express')
const fs = require('fs')
const path = require('path')
const https = require('https')
const dotenv = require('dotenv')

// Load environment variables.
// Prefer server/.env, but also support repo-root .env for convenience.
const envCandidates = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
]
let loadedEnvPath = null
for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: false })
    loadedEnvPath = loadedEnvPath || p
  }
}

const app = express()
const PORT = parseInt(process.env.PORT || '3002', 10)

// Allow browser requests from GitHub Pages (or any other frontend).
// If you call this API from a different origin (e.g. GitHub Pages), the browser will block requests
// unless CORS headers are present.
const CORS_ORIGIN_RAW = String(process.env.CORS_ORIGIN || '')

function normalizeOrigin(input) {
  const s = String(input || '')
    .replace(/[\r\n]+/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')

  if (!s) return ''
  if (s === '*') return '*'

  // Accept values like:
  // - https://imnjl.github.io
  // - https://imnjl.github.io/concrete_factory
  // - https://imnjl.github.io/
  try {
    const u = new URL(s)
    return u.origin
  } catch (_) {
    // Not a full URL; best-effort strip trailing slash
    return s.replace(/\/+$/, '')
  }
}

const ALLOWED_ORIGINS = CORS_ORIGIN_RAW
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean)

function resolveCorsAllowOrigin(requestOrigin) {
  const reqOrigin = normalizeOrigin(requestOrigin)
  if (!reqOrigin) {
    // No Origin header (curl/server-to-server) — allow.
    return ALLOWED_ORIGINS[0] || '*'
  }

  if (ALLOWED_ORIGINS.length === 0) return '*'
  if (ALLOWED_ORIGINS.includes('*')) return '*'
  if (ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin
  return ''
}

app.use((req, res, next) => {
  const allowOrigin = resolveCorsAllowOrigin(req.headers.origin)
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))

// Serve static site from ../frontend
const frontendPath = path.join(__dirname, '../frontend')
app.use(express.static(frontendPath))

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'))
})

// orders file
const ordersFile = path.join(__dirname, 'orders.json')

// contact messages file
const messagesFile = path.join(__dirname, 'messages.json')

// prices file
const pricesFile = path.join(__dirname, 'prices.json')
const concretePriceFile = path.join(__dirname, '../assets/concretePriceInfo.json')

// --- Email sending (recommended): HTTPS Email API (Resend) ---
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase()

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatIntSpaces(n) {
  const num = Number(n)
  if (!isFinite(num)) return String(n ?? '')
  return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatRubles(n) {
  const num = Number(n)
  if (!isFinite(num)) return String(n ?? '')
  return `${formatIntSpaces(num)} ₽`
}

function formatDateTimeRu(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(String(isoOrDate || ''))
  if (!isFinite(d.getTime())) return String(isoOrDate || '')
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch (_) {
    return d.toISOString()
  }
}

function buildOrderEmail({ now, order, markdown, ip }) {
  const safeOrder = order && typeof order === 'object' ? order : {}
  const details = Array.isArray(safeOrder.details) ? safeOrder.details : []
  const buyerName = String(safeOrder.buyerName || '').trim()
  const buyerPhone = String(safeOrder.buyerPhone || '').trim()
  const buyerEmail = String(safeOrder.buyerEmail || '').trim()

  const materialTotal = safeOrder.materialTotal
  const delivery = safeOrder.delivery
  const total = safeOrder.total
  const km = safeOrder.km

  const prettyNow = formatDateTimeRu(now)
  const subjectTotal = isFinite(Number(total)) ? ` — ${formatRubles(total)}` : ''
  const subject = `Новый заказ с сайта${subjectTotal}`

  const rowsHtml = details.length
    ? details.map((d, idx) => {
        const type = escapeHtml(d && d.type ? d.type : '—')
        const mark = escapeHtml(d && d.mark ? d.mark : '—')
        const frost = d && d.frost ? ` (F${escapeHtml(d.frost)})` : ''
        const vol = escapeHtml(d && d.vol !== undefined ? d.vol : '—')
        const price = isFinite(Number(d && d.price)) ? formatRubles(d.price) : escapeHtml(d && d.price)
        const cost = isFinite(Number(d && d.cost)) ? formatRubles(d.cost) : escapeHtml(d && d.cost)
        return `
          <tr>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap;">${idx + 1}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;">${type}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;">${mark}${frost}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap;">${vol}</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap;">${escapeHtml(price)}/м³</td>
            <td style="padding:10px 12px;border-top:1px solid #e5e7eb;color:#111827;text-align:right;white-space:nowrap;font-weight:600;">${escapeHtml(cost)}</td>
          </tr>
        `.trim()
      }).join('')
    : `
        <tr>
          <td colspan="6" style="padding:12px;border-top:1px solid #e5e7eb;color:#6b7280;">Нет позиций (проверьте данные заказа)</td>
        </tr>
      `.trim()

  const deliveryLabel = (km !== undefined && km !== null && String(km).trim() !== '')
    ? `Доставка (${escapeHtml(km)} км)`
    : 'Доставка'

  const totalsHtml = `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr>
        <td style="padding:8px 0;color:#374151;">Материал</td>
        <td style="padding:8px 0;color:#111827;text-align:right;font-weight:600;">${escapeHtml(formatRubles(materialTotal))}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#374151;">${deliveryLabel}</td>
        <td style="padding:8px 0;color:#111827;text-align:right;font-weight:600;">${escapeHtml(formatRubles(delivery))}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:#111827;font-size:16px;font-weight:700;border-top:1px solid #e5e7eb;">Итог</td>
        <td style="padding:12px 0;color:#111827;font-size:16px;text-align:right;font-weight:800;border-top:1px solid #e5e7eb;">${escapeHtml(formatRubles(total))}</td>
      </tr>
    </table>
  `.trim()

  const html = `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>Новый заказ</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;">
    <div style="max-width:720px;margin:0 auto;padding:24px 12px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.08);">
        <div style="padding:18px 22px;background:#111827;color:#ffffff;">
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;letter-spacing:0.2px;font-size:18px;font-weight:800;">Новый заказ с сайта</div>
          <div style="margin-top:6px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;color:#cbd5e1;">Получено: ${escapeHtml(prettyNow)}</div>
        </div>

        <div style="padding:22px;">
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111827;font-size:14px;line-height:1.5;">
            <div style="margin:0 0 12px 0;color:#374151;">Состав заказа:</div>

            <table role="table" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
              <thead>
                <tr>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:right;white-space:nowrap;">№</th>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:left;">Тип</th>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:left;">Класс/марка</th>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:right;white-space:nowrap;">Объём (м³)</th>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:right;white-space:nowrap;">Цена</th>
                  <th style="padding:10px 12px;background:#f3f4f6;color:#374151;font-size:12px;text-align:right;white-space:nowrap;">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            ${totalsHtml}

            <div style="margin-top:18px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
              <div style="font-weight:800;margin-bottom:8px;">Контакты покупателя</div>
              <div style="color:#374151;">
                <div style="margin:4px 0;"><span style="color:#6b7280;">Покупатель:</span> ${escapeHtml(buyerName || '—')}</div>
                <div style="margin:4px 0;"><span style="color:#6b7280;">Телефон:</span> ${escapeHtml(buyerPhone || '—')}</div>
                <div style="margin:4px 0;"><span style="color:#6b7280;">Email:</span> ${buyerEmail ? `<a href="mailto:${escapeHtml(buyerEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(buyerEmail)}</a>` : '—'}</div>
              </div>
            </div>

            <div style="margin-top:14px;color:#6b7280;font-size:12px;">
              IP: ${escapeHtml(ip || '—')}
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:10px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;color:#94a3b8;text-align:center;">
        Это автоматическое письмо с сайта. Если нужно ответить покупателю — используйте Reply.
      </div>
    </div>
  </body>
</html>
  `.trim()

  const text = `Получен заказ (${prettyNow})\n\n${markdown || ''}\n\nIP: ${ip || '—'}`

  return { subject, html, text, replyTo: buyerEmail }
}

function buildContactEmail({ now, name, phone, email, title, message, ip }) {
  const prettyNow = formatDateTimeRu(now)
  const subject = title ? `Заявка с сайта — ${title}` : `Заявка с сайта — ${prettyNow}`

  const html = `
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Заявка с сайта</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;">
    <div style="max-width:720px;margin:0 auto;padding:24px 12px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(17,24,39,0.08);">
        <div style="padding:18px 22px;background:#0f172a;color:#ffffff;">
          <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:18px;font-weight:800;">Новая заявка с сайта</div>
          <div style="margin-top:6px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:12px;color:#cbd5e1;">Получено: ${escapeHtml(prettyNow)}</div>
        </div>
        <div style="padding:22px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#111827;font-size:14px;line-height:1.5;">
          <div style="padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            <div style="margin:4px 0;"><span style="color:#6b7280;">Имя:</span> ${escapeHtml(name || '—')}</div>
            <div style="margin:4px 0;"><span style="color:#6b7280;">Телефон:</span> ${escapeHtml(phone || '—')}</div>
            <div style="margin:4px 0;"><span style="color:#6b7280;">Email:</span> ${email ? `<a href="mailto:${escapeHtml(email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(email)}</a>` : '—'}</div>
            <div style="margin:4px 0;"><span style="color:#6b7280;">Тема:</span> ${escapeHtml(title || '—')}</div>
          </div>

          <div style="margin-top:14px;font-weight:800;">Сообщение</div>
          <div style="margin-top:8px;padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;white-space:pre-wrap;">${escapeHtml(message || '')}</div>

          <div style="margin-top:14px;color:#6b7280;font-size:12px;">IP: ${escapeHtml(ip || '—')}</div>
        </div>
      </div>
    </div>
  </body>
</html>
  `.trim()

  const text = `Получено письмо с сайта\n\nВремя: ${prettyNow}\nИмя: ${name || '—'}\nТелефон: ${phone || '—'}\nEmail: ${email || '—'}\nТема: ${title || '—'}\n\nСообщение:\n${message || ''}\n\nIP: ${ip || '—'}`
  return { subject, html, text, replyTo: email ? String(email).trim() : '' }
}

function getEnvelopeFromEnv() {
  const toEmail = (process.env.TO_EMAIL || '').trim()
  const fromEmail = (process.env.FROM_EMAIL || '').trim()
  const fromName = (process.env.FROM_NAME || 'Site').trim()
  return { toEmail, fromEmail, fromName }
}

function resendRequest(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.resend.com',
        path: '/emails',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
        timeout: 15_000,
      },
      (resp) => {
        let chunks = ''
        resp.setEncoding('utf8')
        resp.on('data', (d) => { chunks += d })
        resp.on('end', () => {
          const status = resp.statusCode || 0
          let parsed = null
          try { parsed = chunks ? JSON.parse(chunks) : null } catch (_) {}
          if (status >= 200 && status < 300) {
            resolve({ ok: true, status, data: parsed })
          } else {
            const err = new Error(parsed && parsed.message ? parsed.message : (chunks || `HTTP ${status}`))
            err.statusCode = status
            err.responseBody = chunks
            reject(err)
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error('Request timeout')))
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function sendEmail({ subject, text, html, replyTo }) {
  const { toEmail, fromEmail, fromName } = getEnvelopeFromEnv()

  if (!toEmail || !fromEmail) {
    const err = new Error('Email is not configured (set TO_EMAIL and FROM_EMAIL in .env)')
    err.code = 'CONFIG'
    throw err
  }

  if (EMAIL_PROVIDER !== 'resend') {
    const err = new Error(`Unsupported EMAIL_PROVIDER: ${EMAIL_PROVIDER}. Use EMAIL_PROVIDER=resend.`)
    err.code = 'CONFIG'
    throw err
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  if (!apiKey) {
    const err = new Error('Resend is not configured (set RESEND_API_KEY in .env)')
    err.code = 'CONFIG'
    throw err
  }

  const payload = {
    from: `${fromName} <${fromEmail}>`,
    to: [toEmail],
    subject,
    text,
    ...(html ? { html } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
  }

  return resendRequest(apiKey, payload)
}

function classifyEmailError(err) {
  const message = (err && err.message) ? String(err.message) : String(err || '')
  const code = (err && (err.code || err.errno)) ? String(err.code || err.errno) : ''
  const statusCode = (err && err.statusCode) ? err.statusCode : null
  const msg = message.toLowerCase()

  let hint = null
  if (code === 'CONFIG') {
    hint = 'Проверьте переменные окружения: EMAIL_PROVIDER, RESEND_API_KEY, TO_EMAIL, FROM_EMAIL.'
  } else if (statusCode === 401 || msg.includes('unauthorized') || msg.includes('invalid api key')) {
    hint = 'Неверный RESEND_API_KEY или ключ не активен.'
  } else if (statusCode === 403 || msg.includes('forbidden')) {
    hint = 'Запрещён отправитель FROM_EMAIL: для Resend нужен верифицированный домен. Для теста используйте onboarding@resend.dev.'
  }

  return { message, code: code || null, statusCode, hint }
}

// Startup info (no secrets)
console.log(`ENV: ${loadedEnvPath ? `loaded from ${loadedEnvPath}` : 'no .env found (using process env only)'}`)
console.log(`Server: http://localhost:${PORT}`)
console.log(
  'Email config:',
  JSON.stringify({
    provider: EMAIL_PROVIDER,
    resendApiKey: (process.env.RESEND_API_KEY || '').trim() ? 'set' : 'missing',
    toEmail: (process.env.TO_EMAIL || '').trim() ? 'set' : 'missing',
    fromEmail: (process.env.FROM_EMAIL || '').trim() ? 'set' : 'missing'
  })
)

app.get('/api/email/status', async (req, res) => {
  const { toEmail, fromEmail, fromName } = getEnvelopeFromEnv()
  const apiKeySet = Boolean(String(process.env.RESEND_API_KEY || '').trim())
  const enabled = Boolean(EMAIL_PROVIDER === 'resend' && apiKeySet && toEmail && fromEmail)
  const hint = enabled
    ? null
    : 'Email API не настроен. Укажите EMAIL_PROVIDER=resend, RESEND_API_KEY, TO_EMAIL, FROM_EMAIL. Для быстрого теста можно поставить FROM_EMAIL=onboarding@resend.dev.'

  res.json({
    enabled,
    provider: EMAIL_PROVIDER,
    envelope: { toEmail, fromEmail, fromName },
    providerConfig: {
      resend: { apiKey: apiKeySet ? 'set' : 'missing' }
    },
    hint
  })
})

app.post('/api/email/test', async (req, res) => {
  try {
    const now = new Date().toISOString()
    const prettyNow = formatDateTimeRu(now)
    await sendEmail({
      subject: `Email test — ${prettyNow} (МСК)`,
      text: `Email test OK. Time (MSK): ${prettyNow}\nISO: ${now}`,
      html: `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">Email test OK.<br/>Time (MSK): ${escapeHtml(prettyNow)}<br/>ISO: ${escapeHtml(now)}</div>`
    })
    res.json({ ok: true })
  } catch (err) {
    const info = classifyEmailError(err)
    res.status(500).json({ ok: false, error: info.message, code: info.code, statusCode: info.statusCode, hint: info.hint })
  }
})

app.post('/api/order', async (req, res) => {
  const now = new Date().toISOString()
  const payload = { receivedAt: now, body: req.body }
  // append to orders file (create if missing)
  try {
    let arr = []
    if (fs.existsSync(ordersFile)) {
      const txt = fs.readFileSync(ordersFile, 'utf8')
      arr = JSON.parse(txt || '[]')
    }
    arr.push(payload)
    fs.writeFileSync(ordersFile, JSON.stringify(arr, null, 2), 'utf8')
    console.log('Order received:', payload)

    const md = (req.body && req.body.markdown)
      ? String(req.body.markdown)
      : JSON.stringify(req.body.order || req.body, null, 2)

    const built = buildOrderEmail({
      now,
      order: (req.body && req.body.order) ? req.body.order : null,
      markdown: md,
      ip: req.ip,
    })

    let email = { attempted: false, sent: false }
    email.attempted = true
    try {
      await sendEmail({ subject: built.subject, text: built.text, html: built.html, replyTo: built.replyTo })
      email.sent = true
      console.log('Order email sent')
    } catch (mailErr) {
      const info = classifyEmailError(mailErr)
      email.error = info.message
      email.code = info.code
      email.statusCode = info.statusCode
      email.hint = info.hint
      console.error('Failed to send order email', mailErr)
    }

    res.json({ ok: true, email })
  } catch (err) {
    console.error('Failed to save order', err)
    res.status(500).send('Failed to save order')
  }
})

// Load prices from JSON
const loadPrices = () => {
  if (fs.existsSync(pricesFile)) {
    return JSON.parse(fs.readFileSync(pricesFile, 'utf-8'))
  }
  return []
}

// Save prices to JSON
const savePrices = (prices) => {
  fs.writeFileSync(pricesFile, JSON.stringify(prices, null, 2))
}

const loadConcretePriceInfo = () => {
  if (!fs.existsSync(concretePriceFile)) return null
  try {
    return JSON.parse(fs.readFileSync(concretePriceFile, 'utf-8'))
  } catch (_) {
    return null
  }
}

const saveConcretePriceInfo = (payload) => {
  fs.writeFileSync(concretePriceFile, JSON.stringify(payload, null, 2), 'utf8')
}

// Routes
app.get('/api/prices', (req, res) => {
  const prices = loadPrices()
  res.json(prices)
})

app.post('/api/prices', (req, res) => {
  const { mark, price } = req.body
  if (!mark || !price) {
    return res.status(400).json({ error: 'Mark and price are required' })
  }

  const prices = loadPrices()
  prices.push({ mark, price })
  savePrices(prices)

  res.status(201).json({ message: 'Price added successfully' })
})

app.get('/api/concrete-price', (req, res) => {
  const data = loadConcretePriceInfo()
  if (!data) return res.status(500).json({ ok: false, error: 'Failed to read concrete price data' })
  res.json(data)
})

app.put('/api/concrete-price', (req, res) => {
  const payload = req.body
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Payload is required' })
  }
  if (!Array.isArray(payload.sections)) {
    return res.status(400).json({ ok: false, error: 'Payload.sections must be an array' })
  }

  try {
    saveConcretePriceInfo(payload)
    res.json({ ok: true })
  } catch (err) {
    console.error('Failed to save concrete price data', err)
    res.status(500).json({ ok: false, error: 'Failed to save concrete price data' })
  }
})

// Healthcheck endpoint
app.get('/healthcheck', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Ensure static files are served correctly
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Form submission route
app.post('/sendform', async (req, res) => {
  const name = (req.body && (req.body.name_user || req.body.name)) ? String(req.body.name_user || req.body.name).trim() : ''
  const phone = (req.body && (req.body.tel || req.body.phone)) ? String(req.body.tel || req.body.phone).trim() : ''
  const email = (req.body && req.body.email) ? String(req.body.email).trim() : ''
  const message = (req.body && req.body.message) ? String(req.body.message).trim() : ''
  const title = (req.body && req.body.title) ? String(req.body.title).trim() : ''

  if (!phone && !email) return res.status(400).json({ ok: false, error: 'Phone or email is required' })
  if (!message) return res.status(400).json({ ok: false, error: 'Message is required' })

  // Always persist message locally, even if SMTP is blocked
  try {
    let arr = []
    if (fs.existsSync(messagesFile)) {
      const txt = fs.readFileSync(messagesFile, 'utf8')
      arr = JSON.parse(txt || '[]')
    }
    arr.push({ receivedAt: new Date().toISOString(), name, phone, email, title, message, ip: req.ip })
    fs.writeFileSync(messagesFile, JSON.stringify(arr, null, 2), 'utf8')
  } catch (persistErr) {
    console.error('Failed to persist contact message', persistErr)
  }

  const now = new Date().toISOString()
  const built = buildContactEmail({
    now,
    name,
    phone,
    email,
    title,
    message,
    ip: req.ip,
  })

  try {
    await sendEmail({ subject: built.subject, text: built.text, html: built.html, replyTo: built.replyTo })
    console.log('Form email sent')
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Failed to send form email:', error)
    const info = classifyEmailError(error)
    // Still return ok=false but mention that message is saved locally
    res.status(500).json({
      ok: false,
      error: info.message,
      code: info.code,
      statusCode: info.statusCode,
      hint: info.hint,
      saved: true
    })
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
