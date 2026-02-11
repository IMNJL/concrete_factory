export class ContactFormController {
  constructor(orderApiService) {
    this.orderApiService = orderApiService
    this.form = document.getElementById('contactForm')
    this.status = document.getElementById('contactStatus')
  }

  init() {
    if (!this.form) return

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
}
