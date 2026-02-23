export class ContactFormController {
  constructor(orderApiService) {
    this.orderApiService = orderApiService
    this.form = document.getElementById('contactForm')
    this.status = document.getElementById('contactStatus')
  }

  init() {
    if (!this.form) return

    this.initPhonePrefix()

    this.form.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (this.status) this.status.textContent = 'Отправка...'

      try {
        const payload = Object.fromEntries(new FormData(this.form).entries())
        const result = await this.orderApiService.submitContact(payload)

        if (result && result.ok) {
          if (this.status) this.status.textContent = 'Отправлено.'
          this.form.reset()
          return
        }

        if (this.status) this.status.textContent = 'Ошибка отправки'
        alert('Сообщение сохранено на сервере, но не отправлено на почту.')
      } catch (error) {
        console.error(error)
        if (this.status) this.status.textContent = 'Ошибка'
        alert(`Ошибка отправки формы.\n${error.message}`)
      }
    })
  }

  initPhonePrefix() {
    const phoneInput = this.form.querySelector('input[name="tel"], input[name="phone"], input[type="tel"]')
    if (!phoneInput) return

    phoneInput.addEventListener('focus', () => {
      const current = String(phoneInput.value || '').trim()
      if (!current) phoneInput.value = '+7 '
    })

    phoneInput.addEventListener('input', () => {
      const next = this.normalizePhoneValue(phoneInput.value)
      if (phoneInput.value !== next) phoneInput.value = next
    })
  }

  normalizePhoneValue(value) {
    const raw = String(value || '')
      .replace(/[^\d+()\s-]/g, '')
    const digits = raw.replace(/\D/g, '')

    if (!digits) return '+7 '
    if (raw.startsWith('+7')) return raw
    if (raw.startsWith('8')) return `+7${raw.slice(1)}`
    if (raw.startsWith('7')) return `+${raw}`
    return `+7 ${digits}`
  }
}
