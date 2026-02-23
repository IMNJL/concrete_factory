import { PhoneUtils, PriceFormatter, TextUtils } from '../utils.js'

const SALES_MAX_URL = 'https://max.ru/u/f9LHodD0cOJ8VJsx6bZSRmaL77_cCOKRXJrVTLAYxe-2ylGJE3xjRpq7OjM'

export class PriceViewController {
  constructor(contentService) {
    this.contentService = contentService
  }

  async renderPriceTable(appData) {
    const container = document.getElementById('priceTable')
    if (!container) return

    const data = await this.contentService.loadConcretePriceInfo()
    if (!data) {
      this.renderLocalPriceTable(container, appData)
      return
    }

    this.renderConcretePriceSheet(data, container)
  }

  renderLocalPriceTable(container, appData) {
    container.innerHTML = ''
    const prices = (appData && Array.isArray(appData.prices)) ? appData.prices : []
    prices.forEach((item) => {
      const row = document.createElement('div')
      row.className = 'price-row'
      row.innerHTML = `<div><div class="price-mark">${TextUtils.escapeHtml(item.mark)}</div><div class="small">бетон</div></div><div class="price-amount">${PriceFormatter.formatPrice(item.price)} ₽</div>`
      container.appendChild(row)
    })
  }

  renderConcretePriceSheet(data, container) {
    const meta = data.meta || {}
    const contacts = data.contacts || {}

    const title = meta.title ? TextUtils.escapeHtml(meta.title) : 'Прайс-лист'
    const effective = meta.effectiveFrom ? `с ${TextUtils.escapeHtml(meta.effectiveFrom)}` : ''
    const note = meta.headerNote ? TextUtils.escapeHtml(meta.headerNote) : ''
    const site = meta.site ? TextUtils.escapeHtml(meta.site) : ''

    const sections = Array.isArray(data.sections) ? data.sections : []
    const sectionsHtml = sections.map((section) => {
      if (!section || section.type !== 'table') return ''

      const secTitle = section.title ? TextUtils.escapeHtml(section.title) : ''
      const subtitle = section.subtitle ? `<div class="price-section-subtitle">${TextUtils.escapeHtml(section.subtitle)}</div>` : ''
      const columns = Array.isArray(section.columns) ? section.columns : []
      const rows = Array.isArray(section.rows) ? section.rows : []

      const thead = columns.length
        ? `<thead><tr>${columns.map((column) => {
          const key = column && column.key
          const isPrice = key === 'price' || key === 'priceVat'
          const className = isPrice ? ' class="price-head"' : ''
          return `<th${className}>${TextUtils.escapeHtml(column.label || column.key || '')}</th>`
        }).join('')}</tr></thead>`
        : ''

      const tbody = `<tbody>${rows.map((row) => {
        const tds = columns.length
          ? columns.map((column) => {
            const key = column.key
            const value = (row && key in row) ? row[key] : ''
            if (key === 'price' || key === 'priceVat') {
              return `<td class="price-cell">${PriceFormatter.formatRubles(value)}</td>`
            }
            return `<td>${TextUtils.escapeHtml(value)}</td>`
          }).join('')
          : Object.values(row || {}).map((value) => `<td>${TextUtils.escapeHtml(value)}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')}</tbody>`

      return `
        <div class="price-section">
          ${secTitle ? `<div class="price-section-title">${secTitle}</div>` : ''}
          ${subtitle}
          <div class="price-table-wrap">
            <table class="price-table" role="table">
              ${thead}
              ${tbody}
            </table>
          </div>
        </div>
      `.trim()
    }).join('')

    const headerRight = []
    if (contacts.salesPhone) {
      headerRight.push(`<div class="price-sheet-contact"><span class="small">${TextUtils.escapeHtml(contacts.salesLabel || 'Отдел продаж: ')}</span><a href="${PhoneUtils.telHref(contacts.salesPhone)}">${TextUtils.escapeHtml(contacts.salesPhone)}</a></div>`)
    }
    if (site) headerRight.push(`<div class="price-sheet-site">${site}</div>`)

    container.innerHTML = `
      <div class="price-sheet">
        <div class="price-sheet-header">
          <div class="price-sheet-left">
            <div class="price-sheet-title">${title}${effective ? ` <span class="price-sheet-date">${effective}</span>` : ''}</div>
            ${note ? `<div class="price-sheet-note">${note}</div>` : ''}
          </div>
          ${headerRight.length ? `<div class="price-sheet-right">${headerRight.join('')}</div>` : ''}
        </div>
        ${sectionsHtml}
      </div>
    `.trim()
  }

  renderHeaderTelegramContacts(data) {
    const contacts = data && data.contacts ? data.contacts : null
    if (!contacts) return

    const dispatcherPhone = contacts.dispatcherPhone || ''
    const salesPhone = contacts.salesPhone || ''

    const dispatcherTelegram = document.getElementById('headerTelegramDispatcherLink')
    const dispatcherPhoneLink = document.getElementById('headerDispatcherPhoneLink')
    const dispatcherMaxLink = document.getElementById('headerDispatcherMaxLink')
    if (dispatcherTelegram) dispatcherTelegram.href = PhoneUtils.telegramPhoneUrl(dispatcherPhone)
    if (dispatcherMaxLink) dispatcherMaxLink.href = PhoneUtils.telHref(dispatcherPhone)
    if (dispatcherPhoneLink) {
      dispatcherPhoneLink.textContent = dispatcherPhone || '—'
      dispatcherPhoneLink.href = PhoneUtils.telHref(dispatcherPhone)
    }

    const salesTelegram = document.getElementById('headerTelegramSalesLink')
    const salesPhoneLink = document.getElementById('headerSalesPhoneLink')
    const salesMaxLink = document.getElementById('headerSalesMaxLink')
    if (salesTelegram) salesTelegram.href = PhoneUtils.telegramPhoneUrl(salesPhone)
    if (salesMaxLink) salesMaxLink.href = SALES_MAX_URL
    if (salesPhoneLink) {
      salesPhoneLink.textContent = salesPhone || '—'
      salesPhoneLink.href = PhoneUtils.telHref(salesPhone)
    }
  }

  renderMainExtraContacts(data) {
    const container = document.getElementById('mainContactsExtra')
    if (!data || !container) return

    const contacts = data.contacts || {}
    const items = []

    if (contacts.dispatcherPhone || contacts.dispatcherEmail) {
      items.push(`
        <div class="contact-line">
          <span class="small">Диспетчер</span>
          <div class="contact-values">
            ${contacts.dispatcherPhone ? `<a href="${PhoneUtils.telHref(contacts.dispatcherPhone)}">${TextUtils.escapeHtml(contacts.dispatcherPhone)}</a>` : ''}
            ${contacts.dispatcherEmail ? `<a href="mailto:${TextUtils.escapeHtml(contacts.dispatcherEmail)}">${TextUtils.escapeHtml(contacts.dispatcherEmail)}</a>` : ''}
          </div>
        </div>
      `.trim())
    }

    if (contacts.labContact || contacts.labPhone) {
      items.push(`
        <div class="contact-line">
          <span class="small">Лаборатория</span>
          <div class="contact-values">
            ${contacts.labContact ? `<span>${TextUtils.escapeHtml(contacts.labContact)}</span>` : ''}
            ${contacts.labPhone ? `<a href="${PhoneUtils.telHref(contacts.labPhone)}">${TextUtils.escapeHtml(contacts.labPhone)}</a>` : ''}
          </div>
        </div>
      `.trim())
    }

    if (Array.isArray(contacts.additionalPhones)) {
      contacts.additionalPhones.forEach((entry) => {
        const name = entry && entry.name ? entry.name : 'Контакт'
        const phones = Array.isArray(entry && entry.phones) ? entry.phones : []
        const note = entry && entry.note ? entry.note : ''
        if (!phones.length && !note) return

        items.push(`
          <div class="contact-line">
            <span class="small">${TextUtils.escapeHtml(name)}</span>
            <div class="contact-values">
              ${phones.map((phone) => `<a href="${PhoneUtils.telHref(phone)}">${TextUtils.escapeHtml(phone)}</a>`).join('<span class="contact-sep">/</span>')}
              ${note ? `<span class="small">(${TextUtils.escapeHtml(note)})</span>` : ''}
            </div>
          </div>
        `.trim())
      })
    }

    container.innerHTML = items.join('') || ''
  }

  renderAboutSecondaryInfo(data) {
    const container = document.getElementById('aboutSecondaryInfo')
    if (!container) return

    if (!data) {
      container.innerHTML = '<div class="small">Информация временно недоступна.</div>'
      return
    }

    const notes = data.notes || {}
    const renderList = (title, items, extraClass = '') => {
      if (!Array.isArray(items) || items.length === 0) return ''
      return `
        <div class="about-secondary-block${extraClass ? ` ${TextUtils.escapeHtml(extraClass)}` : ''}">
          <div class="about-secondary-title">${TextUtils.escapeHtml(title)}</div>
          <ul class="about-secondary-list">${items.map((item) => `<li>${TextUtils.escapeHtml(item)}</li>`).join('')}</ul>
        </div>
      `.trim()
    }

    const mixerAndDelivery = [
      ...(Array.isArray(notes.mixerService) ? notes.mixerService : []),
      ...(Array.isArray(notes.deliveryRates) ? notes.deliveryRates : []),
    ]

    container.innerHTML = [
      renderList('Оплата', notes.payment),
      renderList('Разгрузка и простой', notes.unloading),
      renderList('АБС и доставка', mixerAndDelivery, 'about-secondary-block--wide'),
    ].filter(Boolean).join('') || '<div class="small">Информация временно недоступна.</div>'
  }
}
