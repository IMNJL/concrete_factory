export class NumberUtils {
  static parseLocaleNumber(value) {
    const raw = String(value ?? '').trim()
    if (!raw) return NaN
    return parseFloat(raw.replace(',', '.'))
  }

  static roundTo(value, digits) {
    const num = Number(value)
    if (!Number.isFinite(num)) return NaN
    const pow = 10 ** digits
    return Math.round(num * pow) / pow
  }

  static formatM3(value) {
    const num = Number(value)
    if (!Number.isFinite(num)) return ''
    return num.toFixed(2).replace('.', ',')
  }
}

export class PriceFormatter {
  static formatPrice(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  static formatRubles(value) {
    if (value === null || value === undefined || value === '') return ''
    const num = Number(value)
    if (!Number.isFinite(num)) return TextUtils.escapeHtml(value)
    return `${PriceFormatter.formatPrice(Math.round(num))} ₽`
  }
}

export class TextUtils {
  static escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  static normalizeKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^0-9a-zа-я]+/gi, '-')
      .replace(/^-+|-+$/g, '')
  }
}

export class PhoneUtils {
  static digits(phone) {
    return String(phone || '').replace(/\D/g, '')
  }

  static normalizedForTelegram(phone) {
    const digits = PhoneUtils.digits(phone)
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`
    if (digits.length === 11 && digits.startsWith('7')) return digits
    return digits
  }

  static telegramPhoneUrl(phone) {
    const digits = PhoneUtils.normalizedForTelegram(phone)
    return digits ? `https://t.me/+${digits}` : '#'
  }

  static telHref(phone) {
    const digits = PhoneUtils.digits(phone)
    return digits ? `tel:${digits}` : '#'
  }
}

export class BuyerValidator {
  static isValidName(name) {
    return String(name || '').trim().length >= 2
  }

  static isValidEmail(email) {
    const regex = /^([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)$/
    return regex.test(String(email || '').trim())
  }

  static isValidPhone(phone) {
    const raw = String(phone || '').trim()
    if (!(raw.startsWith('+7') || raw.startsWith('8'))) return false
    const digits = raw.replace(/\D/g, '')
    return digits.length === 11 && (digits[0] === '7' || digits[0] === '8')
  }

  static sanitizeNameInput(name) {
    return String(name || '').replace(/\d+/g, '')
  }

  static sanitizePhoneInput(phone) {
    let value = String(phone || '').replace(/[^0-9+()\s-]+/g, '')
    const hasLeadingPlus = value.startsWith('+')
    value = value.replace(/\+/g, '')
    if (hasLeadingPlus) value = `+${value}`
    return value
  }
}

export class DomUtils {
  static setInvalid(el, invalid) {
    if (!el) return
    el.classList.toggle('is-invalid', Boolean(invalid))
  }

  static setVisible(el, visible) {
    if (!el) return
    el.classList.toggle('is-hidden', !visible)
  }
}
