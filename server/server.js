const express = require('express')
const fs = require('fs')
const path = require('path')
const net = require('net')
const nodemailer = require('nodemailer')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()
const PORT = 3002

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: false }))

// Serve static site from ../frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// orders file
const ordersFile = path.join(__dirname, 'orders.json')

// contact messages file
const messagesFile = path.join(__dirname, 'messages.json')

// prices file
const pricesFile = path.join(__dirname, 'prices.json')

// Create transporter if SMTP config present
function createTransporterFromEnv() {
  const host = (process.env.SMTP_HOST || '').trim()
  const port = parseInt(process.env.SMTP_PORT || '587', 10)

  // If user does not specify SMTP_SECURE, infer from port
  const secureEnv = (process.env.SMTP_SECURE || '').trim()
  const secure = secureEnv
    ? String(secureEnv).toLowerCase() === 'true'
    : port === 465

  const user = (process.env.SMTP_USER || '').trim()
  const pass = process.env.SMTP_PASS || ''
  const debug = String(process.env.SMTP_DEBUG || 'false').toLowerCase() === 'true'
  const requireTLS = String(
    process.env.SMTP_REQUIRE_TLS || (secure ? 'false' : 'true')
  ).toLowerCase() === 'true'

  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    auth: { user, pass },
    tls: {
      servername: host,
      minVersion: 'TLSv1.2'
    },
    // Prevent hanging forever
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    logger: debug,
    debug
  })
}

const transporter = createTransporterFromEnv()
let lastSmtpVerify = { ok: false, at: null, error: null }
if (transporter) {
  transporter
    .verify()
    .then(() => {
      lastSmtpVerify = { ok: true, at: new Date().toISOString(), error: null }
      console.log('SMTP: transporter verified')
    })
    .catch((err) => {
      lastSmtpVerify = {
        ok: false,
        at: new Date().toISOString(),
        error: err && err.message ? err.message : String(err)
      }
      console.warn('SMTP: verify failed:', lastSmtpVerify.error)
    })
} else {
  console.warn('SMTP: disabled (set SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env)')
}

function tcpProbe(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let done = false
    const finish = (res) => {
      if (done) return
      done = true
      try { socket.destroy() } catch (_) {}
      resolve(res)
    }
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => finish({ ok: true }))
    socket.on('timeout', () => finish({ ok: false, error: 'timeout' }))
    socket.on('error', (err) => finish({ ok: false, error: err && err.message ? err.message : String(err) }))
  })
}

app.get('/api/email/status', async (req, res) => {
  const host = (process.env.SMTP_HOST || '').trim()
  const port = parseInt(process.env.SMTP_PORT || '0', 10)
  const toEmail = (process.env.TO_EMAIL || '').trim()
  const fromEmail = (process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim()
  const enabled = Boolean(transporter && host && port && toEmail && fromEmail)
  const probe = (host && port) ? await tcpProbe(host, port, 2500) : { ok: false, error: 'missing host/port' }
  res.json({
    enabled,
    smtp: { host, port },
    envelope: { toEmail, fromEmail },
    lastVerify: lastSmtpVerify,
    tcp: probe
  })
})

app.post('/api/email/test', async (req, res) => {
  const toEmail = (process.env.TO_EMAIL || '').trim()
  const fromName = (process.env.FROM_NAME || 'Site').trim()
  const fromAddr = (process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim()
  if (!transporter || !toEmail || !fromAddr) {
    return res.status(500).json({ ok: false, error: 'SMTP is not configured (check server/.env)' })
  }
  try {
    const now = new Date().toISOString()
    await transporter.sendMail({
      from: `${fromName} <${fromAddr}>`,
      to: toEmail,
      subject: `SMTP test — ${now}`,
      text: `SMTP test OK. Time: ${now}`
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) })
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

    // Try to send email if transporter available and TO_EMAIL is set
    const toEmail = (process.env.TO_EMAIL || '').trim()
    const fromName = (process.env.FROM_NAME || 'Site').trim()
    const fromAddr = (process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim()

    const md = (req.body && req.body.markdown)
      ? req.body.markdown
      : JSON.stringify(req.body.order || req.body, null, 2)

    const subject = `Новый заказ с сайта — ${now}`
    const text = `Получен заказ:\n\n${md}`

    const replyTo = (req.body && req.body.order && req.body.order.buyerEmail)
      ? String(req.body.order.buyerEmail).trim()
      : ''

    let email = { attempted: false, sent: false }
    if (transporter && toEmail && fromAddr) {
      email.attempted = true
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromAddr}>`,
          to: toEmail,
          subject,
          text,
          ...(replyTo ? { replyTo } : {})
        })
        email.sent = true
        console.log('Order email sent to', toEmail)
      } catch (mailErr) {
        email.error = mailErr && mailErr.message ? mailErr.message : String(mailErr)
        console.error('Failed to send order email', mailErr)
      }
    } else {
      if (!transporter) console.warn('SMTP: transporter not configured — skipping email')
      if (!toEmail) console.warn('SMTP: TO_EMAIL not set — skipping email')
      if (!fromAddr) console.warn('SMTP: FROM_EMAIL/SMTP_USER not set — skipping email')
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

  const toEmail = (process.env.TO_EMAIL || '').trim()
  const fromName = (process.env.FROM_NAME || 'Site').trim()
  const fromAddr = (process.env.FROM_EMAIL || process.env.SMTP_USER || '').trim()
  if (!transporter || !toEmail || !fromAddr) {
    return res.status(500).json({ ok: false, error: 'SMTP is not configured (check server/.env)' })
  }

  const now = new Date().toISOString()
  const subject = title ? `Заявка с сайта — ${title}` : `Заявка с сайта — ${now}`
  const text = `Получено письмо с сайта\n\nВремя: ${now}\nИмя: ${name || '—'}\nТелефон: ${phone || '—'}\nEmail: ${email || '—'}\nТема: ${title || '—'}\n\nСообщение:\n${message}\n\nIP: ${req.ip}`

  try {
    await transporter.sendMail({
      from: `${fromName} <${fromAddr}>`,
      to: toEmail,
      subject,
      text,
      ...(email ? { replyTo: email } : {})
    })
    console.log('Form email sent to', toEmail)
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Failed to send form email:', error)
    // Still return ok=false but mention that message is saved locally
    res.status(500).json({
      ok: false,
      error: error && error.message ? error.message : 'Failed to send email',
      saved: true
    })
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
