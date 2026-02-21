import { BuyerValidator, DomUtils, NumberUtils, PriceFormatter } from '../utils.js'

export class CalculatorController {
  constructor(typeRowsController, priceCatalogService, orderApiService) {
    this.typeRowsController = typeRowsController
    this.priceCatalogService = priceCatalogService
    this.orderApiService = orderApiService

    this.calcResult = document.getElementById('calcResult')
    this.deliveryKm = document.getElementById('deliveryKm')
    this.submitStatus = document.getElementById('submitStatus')
  }

  init() {
    this.initBuyerValidation()
    this.initDeliveryInput()
    this.initButtons()
  }

  initBuyerValidation() {
    const buyerName = document.getElementById('buyerName')
    const buyerPhone = document.getElementById('buyerPhone')
    const buyerEmail = document.getElementById('buyerEmail')

    if (buyerName) {
      buyerName.addEventListener('input', () => {
        const cleaned = BuyerValidator.sanitizeNameInput(buyerName.value)
        if (buyerName.value !== cleaned) buyerName.value = cleaned
        DomUtils.setInvalid(buyerName, !BuyerValidator.isValidName(buyerName.value))
      })
    }

    if (buyerPhone) {
      buyerPhone.addEventListener('input', () => {
        const cleaned = BuyerValidator.sanitizePhoneInput(buyerPhone.value)
        if (buyerPhone.value !== cleaned) buyerPhone.value = cleaned
        DomUtils.setInvalid(buyerPhone, !BuyerValidator.isValidPhone(buyerPhone.value))
      })
    }

    if (buyerEmail) {
      buyerEmail.addEventListener('input', () => {
        DomUtils.setInvalid(buyerEmail, !BuyerValidator.isValidEmail(buyerEmail.value))
      })
    }
  }

  initDeliveryInput() {
    if (!this.deliveryKm) return
    this.deliveryKm.addEventListener('input', () => {
      const cleaned = String(this.deliveryKm.value || '').replace(/\D+/g, '')
      if (this.deliveryKm.value !== cleaned) this.deliveryKm.value = cleaned
      this.deliveryKm.classList.remove('is-invalid')
    })
  }

  initButtons() {
    const calcButton = document.getElementById('calcBtn')
    const clearButton = document.getElementById('clearBtn')
    const addTypeButton = document.getElementById('addTypeBtn')
    const submitOrderButton = document.getElementById('submitOrder')

    if (calcButton) {
      calcButton.addEventListener('click', async () => {
        const result = await this.computeTotals()
        if (result.error) {
          if (this.calcResult) this.calcResult.textContent = result.error
          return
        }

        if (this.calcResult) {
          this.calcResult.textContent = `Итог: ${PriceFormatter.formatPrice(result.total)} ₽ (материал ${PriceFormatter.formatPrice(result.materialTotal)} ₽ + доставка ${PriceFormatter.formatPrice(result.delivery)} ₽)`
        }
      })
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => {
        this.typeRowsController.resetVolumes()
        if (this.deliveryKm) {
          this.deliveryKm.value = '5'
          this.deliveryKm.classList.remove('is-invalid')
        }
        if (this.calcResult) this.calcResult.textContent = '—'
      })
    }

    if (addTypeButton) {
      addTypeButton.addEventListener('click', () => {
        this.typeRowsController.appendRow()
        addTypeButton.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }

    if (submitOrderButton) {
      submitOrderButton.addEventListener('click', () => this.submitOrder())
    }
  }

  async computeTotals() {
    const catalog = await this.priceCatalogService.getCatalog()

    const rows = Array.from(document.querySelectorAll('.type-row'))
    if (rows.length === 0) return { error: 'Добавьте хотя бы один тип бетона.' }

    rows.forEach((row) => {
      const input = row.querySelector('.type-volume')
      if (input) input.classList.remove('is-invalid')
    })
    if (this.deliveryKm) this.deliveryKm.classList.remove('is-invalid')

    let materialTotal = 0
    const details = []

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const variant = row.querySelector('.type-variant')
      const volumeInput = row.querySelector('.type-volume')

      if (!variant) return { error: `Внутренняя ошибка: отсутствует выбор марки в строке ${i + 1}` }

      const variantId = String(variant.value || '').trim()
      if (!variantId) return { error: `Выберите класс/марку в строке ${i + 1}` }

      const rawVolume = volumeInput ? String(volumeInput.value || '').trim() : ''
      const parsedVolume = volumeInput ? NumberUtils.parseLocaleNumber(rawVolume) : NaN

      if (!rawVolume || !Number.isFinite(parsedVolume) || !(parsedVolume > 0)) {
        if (volumeInput) volumeInput.classList.add('is-invalid')
        return { error: `Введите объём (>0) в строке ${i + 1}` }
      }

      const volume = NumberUtils.roundTo(parsedVolume, 2)
      if (!Number.isFinite(volume) || !(volume > 0)) {
        if (volumeInput) volumeInput.classList.add('is-invalid')
        return { error: `Введите объём (>0) в строке ${i + 1}` }
      }

      if (volumeInput) volumeInput.value = volume.toFixed(2)

      const item = catalog.itemsById[variantId]
      if (!item) return { error: `Невозможно найти цену для выбранной позиции (строка ${i + 1})` }

      const cost = Math.round(item.price * volume)
      materialTotal += cost

      details.push({
        type: item.typeLabel,
        mark: item.mark,
        frost: item.frost,
        label: item.display,
        vol: volume,
        price: item.price,
        cost,
      })
    }

    const kmRaw = this.deliveryKm ? String(this.deliveryKm.value || '').trim() : ''
    const kmNum = this.deliveryKm ? NumberUtils.parseLocaleNumber(kmRaw) : NaN

    if (kmRaw && !Number.isFinite(kmNum)) {
      if (this.deliveryKm) this.deliveryKm.classList.add('is-invalid')
      return { error: 'Расстояние доставки должно быть числом.' }
    }

    if (Number.isFinite(kmNum) && kmNum < 0) {
      if (this.deliveryKm) this.deliveryKm.classList.add('is-invalid')
      return { error: 'Расстояние доставки не может быть отрицательным.' }
    }

    const km = Number.isFinite(kmNum) ? kmNum : 0
    const delivery = 1500 + (50 * km)
    const total = Math.round(materialTotal + delivery)

    return { details, materialTotal, delivery, total, km }
  }

  async submitOrder() {
    const buyerNameEl = document.getElementById('buyerName')
    const buyerPhoneEl = document.getElementById('buyerPhone')
    const buyerEmailEl = document.getElementById('buyerEmail')

    const buyerName = buyerNameEl ? String(buyerNameEl.value || '') : ''
    const buyerPhone = buyerPhoneEl ? String(buyerPhoneEl.value || '') : ''
    const buyerEmail = buyerEmailEl ? String(buyerEmailEl.value || '') : ''

    const badName = !BuyerValidator.isValidName(buyerName)
    const badPhone = !BuyerValidator.isValidPhone(buyerPhone)
    const badEmail = !BuyerValidator.isValidEmail(buyerEmail)

    DomUtils.setInvalid(buyerNameEl, badName)
    DomUtils.setInvalid(buyerPhoneEl, badPhone)
    DomUtils.setInvalid(buyerEmailEl, badEmail)

    if (badName || badPhone || badEmail) {
      const errors = []
      if (badName) errors.push('Имя: минимум 2 символа')
      if (badPhone) errors.push('Телефон: начинается с +7 или 8 и содержит 11 цифр')
      if (badEmail) errors.push('Email: неверный формат')
      alert(errors.join('\n'))
      return
    }

    const result = await this.computeTotals()
    if (result.error) {
      alert(result.error)
      return
    }

    const { details, materialTotal, delivery, total, km } = result
    const lines = []
    lines.push('| № | Тип | Класс/марка | Объём (м³) | Цена/м³ | Стоимость |')
    lines.push('|---:|---|---|---:|---:|---:|')

    details.forEach((detail, index) => {
      const frost = detail.frost ? ` (F${detail.frost})` : ''
      lines.push(`| ${index + 1} | ${detail.type} | ${detail.mark}${frost} | ${NumberUtils.formatM3(detail.vol)} | ${PriceFormatter.formatPrice(detail.price)} ₽ | ${PriceFormatter.formatPrice(detail.cost)} ₽ |`)
    })

    lines.push('')
    lines.push(`**Материал:** ${PriceFormatter.formatPrice(materialTotal)} ₽`)
    lines.push(`**Доставка (${km} км):** ${PriceFormatter.formatPrice(delivery)} ₽`)
    lines.push(`**Итог:** ${PriceFormatter.formatPrice(total)} ₽`)
    lines.push('')
    lines.push(`**Покупатель:** ${buyerName}`)
    lines.push(`**Телефон:** ${buyerPhone}`)
    lines.push(`**Email:** ${buyerEmail}`)

    if (this.submitStatus) this.submitStatus.textContent = 'Отправка...'

    try {
      const response = await this.orderApiService.submitOrder({
        markdown: lines.join('\n'),
        order: { details, materialTotal, delivery, total, km, buyerName, buyerPhone, buyerEmail },
      })

      if (response && response.email && response.email.attempted && !response.email.sent) {
        if (this.submitStatus) this.submitStatus.textContent = 'Заказ сохранён, но письмо не отправлено.'
        alert(`Заказ сохранён на сервере, но письмо не отправилось.\nПричина: ${response.email.error || 'unknown'}`)
      } else if (this.submitStatus) {
        this.submitStatus.textContent = 'Отправлено — проверьте почту предприятия.'
      }
    } catch (error) {
      console.error(error)
      if (this.submitStatus) this.submitStatus.textContent = 'Ошибка отправки (см. консоль)'
      alert(`Ошибка отправки заказа.\n${error.message}`)
    }
  }
}
