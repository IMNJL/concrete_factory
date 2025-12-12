require('dotenv').config()
const express = require('express')
const nodemailer = require('nodemailer')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
// serve static site (parent folder)
app.use('/', express.static(path.join(__dirname, '..')))

// POST /api/order - receive order JSON { markdown, order }
app.post('/api/order', async (req, res) => {
  try{
    const { markdown, order } = req.body
    if(!markdown || !order) return res.status(400).send('Missing payload')

    // create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE === 'true'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const toEmail = process.env.TO_EMAIL
    if(!toEmail) return res.status(500).send('TO_EMAIL not configured')

    const subject = `Новый заказ — Бетонный завод: ${order.mark} ${order.vol}м³`;

    const textBody = markdown + '\n\n(Отправлено автоматически)'
    // we can send html by converting markdown simple (replace newlines)
    const htmlBody = '<pre>' + escapeHtml(markdown) + '</pre>'

    const info = await transporter.sendMail({
      from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
      to: toEmail,
      subject,
      text: textBody,
      html: htmlBody
    })

    console.log('Email sent', info.messageId)
    return res.json({ ok: true, messageId: info.messageId })
  }catch(err){
    console.error(err)
    return res.status(500).send(err.message || 'Error')
  }
})

app.listen(PORT, ()=> console.log(`Server started on ${PORT}. Open http://localhost:${PORT}/site/index.html`))

function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
