import { PriceFormatter, TextUtils } from './utils.js'

export class AppConfigService {
  static getApiBaseUrl() {
    const cfg = (window && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : null
    const raw = cfg && typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl : ''
    return String(raw || '').trim().replace(/\/+$/, '')
  }

  static apiUrl(path) {
    const base = AppConfigService.getApiBaseUrl()
    const cleanPath = String(path || '')
    if (!base) return cleanPath
    return base + (cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`)
  }
}

export class StorageService {
  constructor(key, defaultStateFactory) {
    this.key = key
    this.defaultStateFactory = defaultStateFactory
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key)
      if (!raw) return this.defaultStateFactory()
      return JSON.parse(raw)
    } catch (_) {
      return this.defaultStateFactory()
    }
  }

  save(state) {
    localStorage.setItem(this.key, JSON.stringify(state))
  }
}

export class ContentService {
  constructor() {
    this.concreteInfoPromise = null
    this.companyInfoPromise = null
    this.concreteInfoOverrideKey = 'bz_concrete_price_info_override'
  }

  loadConcretePriceInfo() {
    if (this.concreteInfoPromise) return this.concreteInfoPromise
    this.concreteInfoPromise = fetch('assets/concretePriceInfo.json')
      .then((response) => response.ok ? response.json() : null)
      .then((base) => {
        const override = this.loadConcretePriceInfoOverride()
        return override || base
      })
      .catch(() => null)
    return this.concreteInfoPromise
  }

  loadConcretePriceInfoOverride() {
    try {
      const raw = localStorage.getItem(this.concreteInfoOverrideKey)
      if (!raw) return null
      return JSON.parse(raw)
    } catch (_) {
      return null
    }
  }

  saveConcretePriceInfoOverride(data) {
    localStorage.setItem(this.concreteInfoOverrideKey, JSON.stringify(data))
    this.concreteInfoPromise = Promise.resolve(data)
  }

  loadCompanyInfo() {
    if (this.companyInfoPromise) return this.companyInfoPromise
    this.companyInfoPromise = fetch('assets/companyInfo.json')
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null)
    return this.companyInfoPromise
  }
}

export class PriceCatalogService {
  constructor(contentService, appStateProvider) {
    this.contentService = contentService
    this.appStateProvider = appStateProvider
    this.catalog = null
    this.catalogPromise = null
  }

  getCatalog() {
    if (this.catalog) return Promise.resolve(this.catalog)
    if (this.catalogPromise) return this.catalogPromise

    this.catalogPromise = this.contentService.loadConcretePriceInfo()
      .then((data) => {
        this.catalog = data
          ? this.buildFromConcreteInfo(data)
          : this.buildFromLocalPrices(this.appStateProvider())
        return this.catalog
      })
      .catch(() => {
        this.catalog = this.buildFromLocalPrices(this.appStateProvider())
        return this.catalog
      })

    return this.catalogPromise
  }

  invalidate() {
    this.catalog = null
    this.catalogPromise = null
  }

  buildFromConcreteInfo(data) {
    const sections = Array.isArray(data && data.sections) ? data.sections : []
    const types = []
    const typesByKey = {}
    const itemsById = {}

    sections.forEach((section) => {
      if (!section || section.type !== 'table') return
      const label = String(section.title || '').trim()
      if (!label) return

      const typeKey = TextUtils.normalizeKey(label) || `type-${types.length + 1}`
      const rows = Array.isArray(section.rows) ? section.rows : []

      const items = rows
        .map((row, index) => {
          if (!row) return null
          const mark = String(row.mark || '').trim()
          if (!mark) return null

          const frost = (row.frost !== undefined && row.frost !== null && String(row.frost).trim() !== '')
            ? String(row.frost).trim()
            : ''

          const rawPrice = (row.priceVat !== undefined && row.priceVat !== null) ? row.priceVat : row.price
          const price = Number(rawPrice)
          if (!Number.isFinite(price)) return null

          const idBase = `${typeKey}__${mark}__${frost}`
          const id = TextUtils.normalizeKey(idBase) || `${typeKey}__row-${index}`
          const frostPart = frost ? ` (F${frost})` : ''
          const display = `${mark}${frostPart} — ${PriceFormatter.formatPrice(Math.round(price))} ₽/м³`

          return { id, typeKey, typeLabel: label, mark, frost, price, display }
        })
        .filter(Boolean)

      if (items.length === 0) return
      const type = { key: typeKey, label, items }
      types.push(type)
      typesByKey[typeKey] = type
      items.forEach((item) => {
        itemsById[item.id] = item
      })
    })

    if (types.length === 0) return this.buildFromLocalPrices(this.appStateProvider())
    return { types, typesByKey, itemsById }
  }

  buildFromLocalPrices(data) {
    const list = (data && Array.isArray(data.prices)) ? data.prices : []
    const typeKey = 'local'
    const label = 'Бетон'

    const items = list
      .map((item, index) => {
        if (!item) return null
        const mark = String(item.mark || '').trim()
        const price = Number(item.price)
        if (!mark || !Number.isFinite(price)) return null
        const id = TextUtils.normalizeKey(`${typeKey}__${mark}`) || `${typeKey}__${index}`
        const display = `${mark} — ${PriceFormatter.formatPrice(Math.round(price))} ₽/м³`
        return { id, typeKey, typeLabel: label, mark, frost: '', price, display }
      })
      .filter(Boolean)

    const type = { key: typeKey, label, items }
    const itemsById = {}
    items.forEach((item) => {
      itemsById[item.id] = item
    })

    return { types: [type], typesByKey: { [typeKey]: type }, itemsById }
  }

  populateTypeOptions(select, catalog) {
    if (!select || !catalog) return
    const previous = select.value
    select.innerHTML = ''

    catalog.types.forEach((type) => {
      const option = document.createElement('option')
      option.value = type.key
      option.textContent = type.label
      select.appendChild(option)
    })

    if (previous && catalog.typesByKey[previous]) select.value = previous
  }

  populateVariantOptions(select, catalog, typeKey) {
    if (!select || !catalog) return
    const previous = select.value
    select.innerHTML = ''

    const type = catalog.typesByKey[typeKey] || catalog.types[0]
    if (!type) return

    type.items.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.id
      option.textContent = item.display
      select.appendChild(option)
    })

    if (previous && catalog.itemsById[previous]) {
      const prevItem = catalog.itemsById[previous]
      if (prevItem && prevItem.typeKey === type.key) select.value = previous
    }
  }
}

export class OrderApiService {
  async submitOrder(payload) {
    const response = await fetch(AppConfigService.apiUrl('/api/order'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`)
    }

    return response.json().catch(() => null)
  }

  async submitContact(payload) {
    const response = await fetch(AppConfigService.apiUrl('/sendform'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const message = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Не удалось отправить'
      throw new Error(message)
    }

    return data
  }
}
