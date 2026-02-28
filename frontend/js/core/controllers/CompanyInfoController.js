import { PhoneUtils, TextUtils } from '../utils.js'

export class CompanyInfoController {
  render(company) {
    if (!company) return

    const address = company.address || company.legalAddress || company.postalAddress || ''
    const phone = company.phone || ''

    const headerPhoneLink = document.getElementById('headerPhoneLink')
    if (headerPhoneLink) {
      headerPhoneLink.textContent = phone || '—'
      headerPhoneLink.href = PhoneUtils.telHref(phone)
    }

    const topPhone = document.getElementById('topCompanyPhone')
    if (topPhone) {
      topPhone.textContent = phone || '—'
      topPhone.href = PhoneUtils.telHref(phone)
    }

    const topAddressLink = document.getElementById('topCompanyAddressLink')
    if (topAddressLink) {
      topAddressLink.textContent = address || '—'
      topAddressLink.href = address ? `https://yandex.ru/maps/?text=${encodeURIComponent(address)}` : '#'
    }

    const topReq = document.getElementById('topCompanyRequisites')
    if (topReq) topReq.innerHTML = this.renderRequisitesShort(company) || '—'

    const companyAddress = document.getElementById('companyAddress')
    if (companyAddress) companyAddress.textContent = address || '—'

    const companyPhone = document.getElementById('companyPhoneLink')
    if (companyPhone) {
      companyPhone.textContent = phone || '—'
      companyPhone.href = PhoneUtils.telHref(phone)
    }

    const companyReq = document.getElementById('companyRequisites')
    if (companyReq) companyReq.innerHTML = this.renderRequisites(company) || '—'
  }

  renderRequisites(company) {
    const lines = []
    const name = company.shortName || company.name || company.fullName
    if (name) lines.push(TextUtils.escapeHtml(name))
    if (company.inn) lines.push(`ИНН: ${TextUtils.escapeHtml(company.inn)}`)
    if (company.bankAccount) lines.push(`Расчётный счёт: ${TextUtils.escapeHtml(company.bankAccount)}`)
    if (company.correspondentAccount) lines.push(`Корреспондентский счёт: ${TextUtils.escapeHtml(company.correspondentAccount)}`)
    if (company.bik) lines.push(`БИК: ${TextUtils.escapeHtml(company.bik)}`)
    if (company.bankName) lines.push(`Банк: ${TextUtils.escapeHtml(company.bankName)}`)
    if (lines.length === 0) return ''
    return `<div class="company-requisites-lines">${lines.map((line) => `<div class="req-line">${line}</div>`).join('')}</div>`
  }

  renderRequisitesShort(company) {
    const lines = []
    const name = company.shortName || company.name || company.fullName
    if (name) lines.push(TextUtils.escapeHtml(name))
    if (company.inn) lines.push(`ИНН: ${TextUtils.escapeHtml(company.inn)}`)
    if (lines.length === 0) return ''
    return `<div class="company-requisites-lines">${lines.map((line) => `<div class="req-line">${line}</div>`).join('')}</div>`
  }
}
