// Main app script: handles types list, calculator, admin UI and order submission
document.addEventListener('DOMContentLoaded', ()=>{
  // --- Data model ---
  const DEFAULT_DATA = {
    prices: [
      {mark:'M100',price:2500},
      {mark:'M150',price:2800},
      {mark:'M200',price:3200},
      {mark:'M250',price:3800},
      {mark:'M300',price:4300},
      {mark:'M350',price:4800},
      {mark:'M400',price:5400},
    ],
    mapSrc: document.getElementById('mapFrame') ? document.getElementById('mapFrame').src : ''
  }

  function loadData(){
    try{ const raw = localStorage.getItem('bz_data'); if(!raw) return DEFAULT_DATA; return JSON.parse(raw) }
    catch(e){ console.error(e); return DEFAULT_DATA }
  }
  function saveData(data){ localStorage.setItem('bz_data', JSON.stringify(data)) }

  let appData = loadData()

  // --- Utils ---
  function formatPrice(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') }

  function parseLocaleNumber(val){
    const raw = String(val ?? '').trim()
    if(!raw) return NaN
    return parseFloat(raw.replace(',', '.'))
  }

  function roundTo(n, digits){
    const num = Number(n)
    if(!isFinite(num)) return NaN
    const m = Math.pow(10, digits)
    return Math.round(num * m) / m
  }

  function formatM3(n){
    const num = Number(n)
    if(!isFinite(num)) return ''
    return num.toFixed(2).replace('.', ',')
  }

  function isValidBuyerName(name){
    return String(name || '').trim().length >= 2
  }

  function isValidBuyerEmail(email){
    const re = /^([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)$/
    return re.test(String(email || '').trim())
  }

  function isValidBuyerPhone(phone){
    const raw = String(phone || '').trim()
    if(!(raw.startsWith('+7') || raw.startsWith('8'))) return false
    const digits = raw.replace(/\D/g, '')
    // РФ: +7XXXXXXXXXX или 8XXXXXXXXXX (11 цифр)
    return digits.length === 11 && (digits[0] === '7' || digits[0] === '8')
  }

  function sanitizeBuyerNameInput(name){
    // запрет цифр в имени
    return String(name || '').replace(/\d+/g, '')
  }

  function sanitizeBuyerPhoneInput(phone){
    // запрещаем буквы/прочие символы; оставляем цифры, пробелы, +, (), -
    let s = String(phone || '').replace(/[^0-9+()\s-]+/g, '')
    // '+' допускаем только в начале
    const keepLeadingPlus = s.startsWith('+')
    s = s.replace(/\+/g, '')
    if(keepLeadingPlus) s = '+' + s
    return s
  }

  function setInvalid(el, invalid){
    if(!el) return
    el.classList.toggle('is-invalid', Boolean(invalid))
  }

  function getApiBaseUrl(){
    const cfg = (window && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : null
    const raw = cfg && typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl : ''
    const trimmed = String(raw || '').trim()
    return trimmed.replace(/\/+$/,'')
  }

  function apiUrl(p){
    const base = getApiBaseUrl()
    const path = String(p || '')
    if(!base) return path
    return base + (path.startsWith('/') ? path : `/${path}`)
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function formatRubles(n){
    if(n === null || n === undefined || n === '') return ''
    const num = Number(n)
    if(!isFinite(num)) return escapeHtml(n)
    return `${formatPrice(Math.round(num))} ₽`
  }

  let concretePriceInfoPromise = null
  function loadConcretePriceInfo(){
    if(concretePriceInfoPromise) return concretePriceInfoPromise
    concretePriceInfoPromise = fetch('assets/concretePriceInfo.json')
      .then(r=> r.ok ? r.json() : null)
      .catch(()=>null)
    return concretePriceInfoPromise
  }

  let companyInfoPromise = null
  function loadCompanyInfo(){
    if(companyInfoPromise) return companyInfoPromise
    companyInfoPromise = fetch('assets/companyInfo.json')
      .then(r=> r.ok ? r.json() : null)
      .catch(()=>null)
    return companyInfoPromise
  }

  function phoneDigits(phone){
    return String(phone || '').replace(/\D/g, '')
  }

  function viberNumber(phone){
    const digits = phoneDigits(phone)
    if(digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`
    if(digits.length === 11 && digits.startsWith('7')) return digits
    return digits
  }

  function telegramPhoneUrl(phone){
    const digits = viberNumber(phone)
    return digits ? `https://t.me/+${digits}` : '#'
  }

  function yandexMapsAddressUrl(address){
    const a = String(address || '').trim()
    if(!a) return '#'
    return `https://yandex.ru/maps/?text=${encodeURIComponent(a)}`
  }

  function renderCompanyRequisitesHtml(company){
    if(!company) return ''
    const lines = []
    const name = company.shortName || company.name || company.fullName
    if(name) lines.push(escapeHtml(name))
    if(company.inn) lines.push(`ИНН: ${escapeHtml(company.inn)}`)
    if(company.bankAccount) lines.push(`Расчётный счёт: ${escapeHtml(company.bankAccount)}`)
    if(company.correspondentAccount) lines.push(`Корреспондентский счёт: ${escapeHtml(company.correspondentAccount)}`)
    if(company.bik) lines.push(`БИК: ${escapeHtml(company.bik)}`)
    if(company.bankName) lines.push(`Банк: ${escapeHtml(company.bankName)}`)

    if(lines.length === 0) return ''
    return `<div class="company-requisites-lines">${lines.map(l=>`<div class=\"req-line\">${l}</div>`).join('')}</div>`
  }

  function renderCompanyRequisitesShortHtml(company){
    if(!company) return ''
    const lines = []
    const name = company.shortName || company.name || company.fullName
    if(name) lines.push(escapeHtml(name))
    if(company.inn) lines.push(`ИНН: ${escapeHtml(company.inn)}`)
    if(lines.length === 0) return ''
    return `<div class="company-requisites-lines">${lines.map(l=>`<div class=\"req-line\">${l}</div>`).join('')}</div>`
  }

  function renderCompanyContactsOnMainPage(company){
    if(!company) return

    const address = company.address || company.legalAddress || company.postalAddress || ''
    const phone = company.phone || ''

    // Header phone
    const headerPhoneLink = document.getElementById('headerPhoneLink')
    if(headerPhoneLink){
      headerPhoneLink.textContent = phone || '—'
      const d = phoneDigits(phone)
      headerPhoneLink.href = d ? `tel:${d}` : '#'
    }
    const headerTelegramLink = document.getElementById('headerTelegramLink') || document.getElementById('headerViberLink')
    if(headerTelegramLink){
      headerTelegramLink.href = telegramPhoneUrl(phone)
    }

    // Top card (hero)
    const topPhone = document.getElementById('topCompanyPhone')
    if(topPhone) topPhone.textContent = phone || '—'
    const topAddrLink = document.getElementById('topCompanyAddressLink')
    if(topAddrLink){
      topAddrLink.textContent = address || '—'
      topAddrLink.href = address ? yandexMapsAddressUrl(address) : '#'
    }
    const topReq = document.getElementById('topCompanyRequisites')
    if(topReq) topReq.innerHTML = renderCompanyRequisitesShortHtml(company) || '—'

    // Contacts section
    const addrEl = document.getElementById('companyAddress')
    if(addrEl) addrEl.textContent = address || '—'
    const phoneLink = document.getElementById('companyPhoneLink')
    if(phoneLink){
      phoneLink.textContent = phone || '—'
      const d = phoneDigits(phone)
      phoneLink.href = d ? `tel:${d}` : '#'
    }
    const reqEl = document.getElementById('companyRequisites')
    if(reqEl) reqEl.innerHTML = renderCompanyRequisitesHtml(company) || '—'
  }

  // --- Price catalog for calculator (type -> class/mark) ---
  let priceCatalog = null
  let priceCatalogPromise = null

  function normalizeKey(s){
    return String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^0-9a-zа-я]+/gi, '-')
      .replace(/^-+|-+$/g, '')
  }

  function buildPriceCatalogFromConcreteInfo(data){
    const sections = Array.isArray(data && data.sections) ? data.sections : []
    const types = []
    const typesByKey = {}
    const itemsById = {}

    sections.forEach((sec)=>{
      if(!sec || sec.type !== 'table') return
      const label = String(sec.title || '').trim()
      if(!label) return
      const typeKey = normalizeKey(label) || `type-${types.length+1}`
      const rows = Array.isArray(sec.rows) ? sec.rows : []
      const items = rows
        .map((r, idx)=>{
          if(!r) return null
          const mark = String(r.mark || '').trim()
          if(!mark) return null
          const frost = (r.frost !== undefined && r.frost !== null && String(r.frost).trim() !== '') ? String(r.frost).trim() : ''
          const rawPrice = (r.priceVat !== undefined && r.priceVat !== null) ? r.priceVat : r.price
          const price = Number(rawPrice)
          if(!isFinite(price)) return null
          const idBase = `${typeKey}__${mark}__${frost}`
          const id = normalizeKey(idBase) || `${typeKey}__row-${idx}`
          const frostPart = frost ? ` (F${frost})` : ''
          const display = `${mark}${frostPart} — ${formatPrice(Math.round(price))} ₽/м³`
          return { id, typeKey, typeLabel: label, mark, frost, price, display }
        })
        .filter(Boolean)

      if(items.length === 0) return
      const typeObj = { key: typeKey, label, items }
      types.push(typeObj)
      typesByKey[typeKey] = typeObj
      items.forEach(it=>{ itemsById[it.id] = it })
    })

    // If something went wrong, fallback to local list
    if(types.length === 0) return buildPriceCatalogFromLocalPrices(appData)
    return { types, typesByKey, itemsById }
  }

  function buildPriceCatalogFromLocalPrices(data){
    const list = (data && Array.isArray(data.prices)) ? data.prices : []
    const typeKey = 'local'
    const label = 'Бетон'
    const items = list
      .map((p, idx)=>{
        if(!p) return null
        const mark = String(p.mark || '').trim()
        const price = Number(p.price)
        if(!mark || !isFinite(price)) return null
        const id = normalizeKey(`${typeKey}__${mark}`) || `${typeKey}__${idx}`
        const display = `${mark} — ${formatPrice(Math.round(price))} ₽/м³`
        return { id, typeKey, typeLabel: label, mark, frost: '', price, display }
      })
      .filter(Boolean)

    const typeObj = { key: typeKey, label, items }
    const itemsById = {}
    items.forEach(it=>{ itemsById[it.id] = it })
    return { types: [typeObj], typesByKey: {[typeKey]: typeObj}, itemsById }
  }

  function loadPriceCatalog(){
    if(priceCatalog) return Promise.resolve(priceCatalog)
    if(priceCatalogPromise) return priceCatalogPromise
    priceCatalogPromise = loadConcretePriceInfo()
      .then(data=>{
        priceCatalog = data ? buildPriceCatalogFromConcreteInfo(data) : buildPriceCatalogFromLocalPrices(appData)
        return priceCatalog
      })
      .catch(()=>{
        priceCatalog = buildPriceCatalogFromLocalPrices(appData)
        return priceCatalog
      })
    return priceCatalogPromise
  }

  function populateTypeOptions(sel, catalog){
    if(!sel || !catalog) return
    const cur = sel.value
    sel.innerHTML = ''
    catalog.types.forEach(t=>{
      const opt = document.createElement('option')
      opt.value = t.key
      opt.textContent = t.label
      sel.appendChild(opt)
    })
    if(cur && catalog.typesByKey[cur]) sel.value = cur
  }

  function populateVariantOptions(sel, catalog, typeKey){
    if(!sel || !catalog) return
    const cur = sel.value
    sel.innerHTML = ''
    const typeObj = catalog.typesByKey[typeKey] || catalog.types[0]
    if(!typeObj) return
    typeObj.items.forEach(it=>{
      const opt = document.createElement('option')
      opt.value = it.id
      opt.textContent = it.display
      sel.appendChild(opt)
    })
    if(cur && catalog.itemsById[cur]){
      const prev = catalog.itemsById[cur]
      if(prev && prev.typeKey === typeObj.key) sel.value = cur
    }
  }

  function hydrateAllTypeRows(){
    const rows = Array.from(document.querySelectorAll('.type-row'))
    if(rows.length === 0) return
    loadPriceCatalog().then(catalog=>{
      rows.forEach(r=>{
        const kindSel = r.querySelector('.type-kind')
        const variantSel = r.querySelector('.type-variant')
        if(!kindSel || !variantSel) return
        const prevKind = kindSel.value
        const prevVariant = variantSel.value
        populateTypeOptions(kindSel, catalog)
        if(prevKind && catalog.typesByKey[prevKind]) kindSel.value = prevKind
        const typeKey = kindSel.value || (catalog.types[0] && catalog.types[0].key)
        populateVariantOptions(variantSel, catalog, typeKey)
        if(prevVariant && catalog.itemsById[prevVariant]){
          const prev = catalog.itemsById[prevVariant]
          if(prev && prev.typeKey === typeKey) variantSel.value = prevVariant
        }
      })
    })
  }

  function renderConcretePriceSheet(data, container){
    if(!data || !container) return

    const meta = data.meta || {}
    const contacts = data.contacts || {}
    const title = meta.title ? escapeHtml(meta.title) : 'Прайс-лист'
    const effective = meta.effectiveFrom ? `с ${escapeHtml(meta.effectiveFrom)}` : ''
    const note = meta.headerNote ? escapeHtml(meta.headerNote) : ''
    const site = meta.site ? escapeHtml(meta.site) : ''

    const headerLeft = `
      <div class="price-sheet-title">${title}${effective ? ` <span class=\"price-sheet-date\">${effective}</span>` : ''}</div>
      ${note ? `<div class=\"price-sheet-note\">${note}</div>` : ''}
    `.trim()

    const headerRightParts = []
    if(contacts.salesPhone){
      headerRightParts.push(`<div class=\"price-sheet-contact\"><span class=\"small\">${escapeHtml(contacts.salesLabel || 'Отдел продаж: ')}</span><a href=\"tel:${escapeHtml(String(contacts.salesPhone).replace(/\D/g,''))}\">${escapeHtml(contacts.salesPhone)}</a></div>`)
    }
    if(site){
      headerRightParts.push(`<div class=\"price-sheet-site\">${site}</div>`)
    }
    const headerRight = headerRightParts.length ? `<div class="price-sheet-right">${headerRightParts.join('')}</div>` : ''

    const sections = Array.isArray(data.sections) ? data.sections : []
    const sectionsHtml = sections.map(sec=>{
      if(!sec || sec.type !== 'table') return ''
      const secTitle = sec.title ? escapeHtml(sec.title) : ''
      const subtitle = sec.subtitle ? `<div class=\"price-section-subtitle\">${escapeHtml(sec.subtitle)}</div>` : ''

      const cols = Array.isArray(sec.columns) ? sec.columns : []
      const rows = Array.isArray(sec.rows) ? sec.rows : []

      // Do not force percentage widths — keep the table compact so prices stay close to the left.
      const colgroup = ''

      const thead = cols.length
        ? `<thead><tr>${cols.map(c=>{
            const key = c && c.key
            const isPrice = key === 'price' || key === 'priceVat'
            const cls = isPrice ? ' class="price-head"' : ''
            return `<th${cls}>${escapeHtml(c.label || c.key || '')}</th>`
          }).join('')}</tr></thead>`
        : ''

      const tbody = `<tbody>${rows.map(r=>{
        const tds = cols.length
          ? cols.map(c=>{
              const key = c.key
              const val = (r && key in r) ? r[key] : ''
              if(key === 'price' || key === 'priceVat') return `<td class=\"price-cell\">${formatRubles(val)}</td>`
              return `<td>${escapeHtml(val)}</td>`
            }).join('')
          : Object.values(r||{}).map(v=>`<td>${escapeHtml(v)}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')}</tbody>`

      return `
        <div class="price-section">
          ${secTitle ? `<div class=\"price-section-title\">${secTitle}</div>` : ''}
          ${subtitle}
          <div class="price-table-wrap">
            <table class="price-table" role="table">
              ${colgroup}
              ${thead}
              ${tbody}
            </table>
          </div>
        </div>
      `.trim()
    }).join('')

    container.innerHTML = `
      <div class="price-sheet">
        <div class="price-sheet-header">
          <div class="price-sheet-left">${headerLeft}</div>
          ${headerRight}
        </div>
        ${sectionsHtml}
      </div>
    `.trim()
  }

  function renderMainExtraContacts(data, container){
    if(!data || !container) return
    const contacts = data.contacts || {}

    function telHref(phone){
      const digits = String(phone || '').replace(/\D/g, '')
      return digits ? `tel:${digits}` : '#'
    }

    const items = []
    if(contacts.dispatcherPhone || contacts.dispatcherEmail){
      const phone = contacts.dispatcherPhone
      const email = contacts.dispatcherEmail
      items.push(`
        <div class="contact-line">
          <span class="small">Диспетчер</span>
          <div class="contact-values">
            ${phone ? `<a href=\"${telHref(phone)}\">${escapeHtml(phone)}</a>` : ''}
            ${email ? `<a href=\"mailto:${escapeHtml(email)}\">${escapeHtml(email)}</a>` : ''}
          </div>
        </div>
      `.trim())
    }

    if(contacts.labContact || contacts.labPhone){
      const name = contacts.labContact
      const phone = contacts.labPhone
      items.push(`
        <div class="contact-line">
          <span class="small">Лаборатория</span>
          <div class="contact-values">
            ${name ? `<span>${escapeHtml(name)}</span>` : ''}
            ${phone ? `<a href=\"${telHref(phone)}\">${escapeHtml(phone)}</a>` : ''}
          </div>
        </div>
      `.trim())
    }

    if(Array.isArray(contacts.additionalPhones)){
      contacts.additionalPhones.forEach(p=>{
        const name = p && p.name ? p.name : 'Контакт'
        const phones = Array.isArray(p && p.phones) ? p.phones : []
        const note = p && p.note ? p.note : ''
        if(!phones.length && !note) return
        items.push(`
          <div class="contact-line">
            <span class="small">${escapeHtml(name)}</span>
            <div class="contact-values">
              ${phones.map(ph=>`<a href=\"${telHref(ph)}\">${escapeHtml(ph)}</a>`).join('<span class="contact-sep">/</span>')}
              ${note ? `<span class=\"small\">(${escapeHtml(note)})</span>` : ''}
            </div>
          </div>
        `.trim())
      })
    }

    container.innerHTML = items.join('') || ''
  }

  function renderAboutSecondaryInfo(data, container){
    if(!data || !container) return
    const notes = data.notes || {}

    function renderList(title, items){
      if(!Array.isArray(items) || items.length === 0) return ''
      return `
        <div class="about-secondary-block">
          <div class="about-secondary-title">${escapeHtml(title)}</div>
          <ul class="about-secondary-list">
            ${items.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
        </div>
      `.trim()
    }

    container.innerHTML = [
      renderList('Оплата', notes.payment),
      renderList('Разгрузка и простой', notes.unloading),
      renderList('Услуги АБС', notes.mixerService),
      renderList('Доставка (рейс)', notes.deliveryRates)
    ].filter(Boolean).join('') || '<div class="small">Информация временно недоступна.</div>'
  }

  // render global price table and update any selects
  function renderPriceTable(){
    const el = document.getElementById('priceTable'); if(!el) return

    // Keep calculator selects in sync with the actual price catalog (JSON -> fallback)
    hydrateAllTypeRows()

    // Prefer a structured "sheet" from JSON; fallback to the simple local list
    loadConcretePriceInfo().then(data=>{
      if(data){
        renderConcretePriceSheet(data, el)
        return
      }
      el.innerHTML = ''
      appData.prices.forEach(p=>{
        const row = document.createElement('div'); row.className='price-row'
        row.innerHTML = `<div><div class="price-mark">${escapeHtml(p.mark)}</div><div class="small">бетон</div></div><div class="price-amount">${formatPrice(p.price)} ₽</div>`
        el.appendChild(row)
      })
    })
  }

  // --- Types UI ---
  const typesContainer = document.getElementById('typesContainer')
  function createTypeRow(typeKey = '', variantId = '', volume = 1){
    const wrapper = document.createElement('div')
    wrapper.className = 'type-row'
    wrapper.style.display = 'flex'
    wrapper.style.gap = '8px'
    wrapper.style.marginBottom = '8px'

    const kindSel = document.createElement('select')
    kindSel.className = 'type-kind'
    kindSel.style.flex = '1'

    const variantSel = document.createElement('select')
    variantSel.className = 'type-variant'
    variantSel.style.flex = '1.2'

    // hydrate options from JSON catalog (fallback to local list)
    loadPriceCatalog().then(catalog=>{
      populateTypeOptions(kindSel, catalog)
      if(typeKey && catalog.typesByKey[typeKey]) kindSel.value = typeKey
      const effectiveTypeKey = kindSel.value || (catalog.types[0] && catalog.types[0].key)
      if(effectiveTypeKey) populateVariantOptions(variantSel, catalog, effectiveTypeKey)
      if(variantId && catalog.itemsById[variantId]){
        const it = catalog.itemsById[variantId]
        if(it && it.typeKey === effectiveTypeKey) variantSel.value = variantId
      }
    })

    kindSel.addEventListener('change', ()=>{
      loadPriceCatalog().then(catalog=>{
        const tKey = kindSel.value
        populateVariantOptions(variantSel, catalog, tKey)
      })
    })

    const vol = document.createElement('input')
    vol.type = 'number'
    vol.min = '0'
    vol.step = '0.01'
    vol.value = isFinite(Number(volume)) ? Number(volume).toFixed(2) : '1.00'
    vol.className = 'type-volume'
    vol.style.width = '110px'
    vol.style.padding = '10px'
    vol.style.borderRadius = '8px'
    vol.style.border = '1px solid #e5e7eb'

    function updateVolInvalidState(){
      const raw = String(vol.value || '').trim()
      if(raw === ''){
        vol.classList.remove('is-invalid')
        return
      }
      const n = parseLocaleNumber(raw)
      const invalid = !isFinite(n) || !(n > 0)
      vol.classList.toggle('is-invalid', invalid)
    }

    vol.addEventListener('input', updateVolInvalidState)

    const rm = document.createElement('button')
    rm.type = 'button'
    rm.textContent = '✕'
    rm.title = 'Удалить'
    rm.style.background = '#fff'
    rm.style.border = '1px solid #ddd'
    rm.style.borderRadius = '8px'
    rm.style.padding = '8px'
    rm.addEventListener('click', ()=>{ wrapper.remove() })

    wrapper.appendChild(kindSel)
    wrapper.appendChild(variantSel)
    wrapper.appendChild(vol)
    wrapper.appendChild(rm)
    return wrapper
  }

  // ensure at least one row exists
  function ensureInitialType(){
    if(!typesContainer) return
    if(typesContainer.children.length === 0){ typesContainer.appendChild(createTypeRow()) }
  }

  // --- Calculator logic across all types ---
  function computeTotals(){
    if(!priceCatalog) return { error: 'Прайс загружается, попробуйте ещё раз через секунду.' }
    const rows = Array.from(document.querySelectorAll('.type-row'))
    if(rows.length === 0) return { error: 'Добавьте хотя бы один тип бетона.' }

    // reset invalid state from previous run
    rows.forEach(r=>{
      const v = r.querySelector('.type-volume')
      if(v) v.classList.remove('is-invalid')
    })
    const deliveryKmEl = document.getElementById('deliveryKm')
    if(deliveryKmEl) deliveryKmEl.classList.remove('is-invalid')

    let materialTotal = 0
    const details = []
    for(let i=0;i<rows.length;i++){
      const r = rows[i]
      const kindEl = r.querySelector('.type-kind')
      const variantEl = r.querySelector('.type-variant')
      const volEl = r.querySelector('.type-volume')
      if(!kindEl || !variantEl) return { error: `Внутренняя ошибка: отсутствуют селекторы в строке ${i+1}` }
      const variantId = String(variantEl.value || '').trim()
      if(!variantId) return { error: `Выберите класс/марку в строке ${i+1}` }

      const volRaw = volEl ? String(volEl.value || '').trim() : ''
      const volNum = volEl ? parseLocaleNumber(volRaw) : NaN
      const volIsNumber = isFinite(volNum)
      if(!volRaw || !volIsNumber){
        if(volEl) volEl.classList.add('is-invalid')
        return { error: `Введите объём числом в строке ${i+1}` }
      }
      if(!(volNum > 0)){
        if(volEl) volEl.classList.add('is-invalid')
        return { error: `Введите объём (>0) в строке ${i+1}` }
      }

      // normalize to 0.01 m³ precision
      const volRounded = roundTo(volNum, 2)
      if(!isFinite(volRounded) || !(volRounded > 0)){
        if(volEl) volEl.classList.add('is-invalid')
        return { error: `Введите объём (>0) в строке ${i+1}` }
      }
      if(volEl) volEl.value = volRounded.toFixed(2)

      const item = priceCatalog.itemsById[variantId]
      if(!item) return { error: `Невозможно найти цену для выбранной позиции (строка ${i+1})` }
      const price = item.price
      const cost = Math.round(price * volRounded)
      materialTotal += cost
      details.push({
        type: item.typeLabel,
        mark: item.mark,
        frost: item.frost,
        label: item.display,
        vol: volRounded,
        price,
        cost,
      })
    }

    const kmRaw = deliveryKmEl ? String(deliveryKmEl.value || '').trim() : ''
    const kmNum = deliveryKmEl ? parseLocaleNumber(kmRaw) : NaN
    if(kmRaw && !isFinite(kmNum)){
      if(deliveryKmEl) deliveryKmEl.classList.add('is-invalid')
      return { error: 'Расстояние доставки должно быть числом.' }
    }
    if(isFinite(kmNum) && kmNum < 0){
      if(deliveryKmEl) deliveryKmEl.classList.add('is-invalid')
      return { error: 'Расстояние доставки не может быть отрицательным.' }
    }

    const km = isFinite(kmNum) ? kmNum : 0
    const delivery = 1500 + (50 * km)
    const total = Math.round(materialTotal + delivery)
    return {details, materialTotal, delivery, total, km}
  }

  const calcBtn = document.getElementById('calcBtn')
  const clearBtn = document.getElementById('clearBtn')
  const addTypeBtn = document.getElementById('addTypeBtn')
  const submitOrderBtn = document.getElementById('submitOrder')
  const submitStatus = document.getElementById('submitStatus')
  const deliveryKmEl = document.getElementById('deliveryKm')

  const buyerNameEl = document.getElementById('buyerName')
  const buyerPhoneEl = document.getElementById('buyerPhone')
  const buyerEmailEl = document.getElementById('buyerEmail')
  if(buyerNameEl){
    buyerNameEl.addEventListener('input', ()=>{
      const cleaned = sanitizeBuyerNameInput(buyerNameEl.value)
      if(buyerNameEl.value !== cleaned) buyerNameEl.value = cleaned
      setInvalid(buyerNameEl, !isValidBuyerName(buyerNameEl.value))
    })
  }
  if(buyerPhoneEl){
    buyerPhoneEl.addEventListener('input', ()=>{
      const cleaned = sanitizeBuyerPhoneInput(buyerPhoneEl.value)
      if(buyerPhoneEl.value !== cleaned) buyerPhoneEl.value = cleaned
      setInvalid(buyerPhoneEl, !isValidBuyerPhone(buyerPhoneEl.value))
    })
  }
  if(buyerEmailEl){
    buyerEmailEl.addEventListener('input', ()=> setInvalid(buyerEmailEl, !isValidBuyerEmail(buyerEmailEl.value)))
  }

  if(deliveryKmEl){
    deliveryKmEl.addEventListener('input', ()=>{
      const cleaned = String(deliveryKmEl.value || '').replace(/\D+/g, '')
      if(deliveryKmEl.value !== cleaned) deliveryKmEl.value = cleaned
      deliveryKmEl.classList.remove('is-invalid')
    })
  }

  if(calcBtn){
    calcBtn.addEventListener('click', ()=>{
      const res = computeTotals()
      if(res.error){ document.getElementById('calcResult').textContent = res.error; return }
      const {materialTotal, delivery, total} = res
      document.getElementById('calcResult').textContent = `Итог: ${formatPrice(total)} ₽ (материал ${formatPrice(materialTotal)} ₽ + доставка ${formatPrice(delivery)} ₽)`
    })
  }
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      // reset volumes to 1, delivery to 5
      document.querySelectorAll('.type-volume').forEach(inp=>{ inp.value = '1.00'; inp.classList.remove('is-invalid') })
      const deliveryKm = document.getElementById('deliveryKm')
      if(deliveryKm){
        deliveryKm.value = '5'
        deliveryKm.classList.remove('is-invalid')
      }
      document.getElementById('calcResult').textContent = '—'
    })
  }

  // foundation volume calculator
  const volumeCalcBtn = document.getElementById('volumeCalcBtn')
  const volumeClearBtn = document.getElementById('volumeClearBtn')
  const volumeResult = document.getElementById('volumeResult')
  const foundationType = document.getElementById('foundationType')
  const foundationTabs = Array.from(document.querySelectorAll('.foundation-tab'))
  const foundationFormula = document.getElementById('foundationFormula')

  const foundationFieldsStrip = document.getElementById('foundationFieldsStrip')
  const foundationFieldsSlab = document.getElementById('foundationFieldsSlab')
  const foundationFieldsPiles = document.getElementById('foundationFieldsPiles')

  const foundationLength = document.getElementById('foundationLength')
  const foundationWidth = document.getElementById('foundationWidth')
  const foundationHeight = document.getElementById('foundationHeight')

  const slabArea = document.getElementById('slabArea')
  const slabThickness = document.getElementById('slabThickness')
  const pileRadius = document.getElementById('pileRadius')
  const pileHeight = document.getElementById('pileHeight')

  function setConcreteVolumeFromFoundation(volumeM3){
    const v = roundTo(volumeM3, 2)
    if(!isFinite(v) || !(v > 0)) return

    // Ensure there is at least one type row
    if(typesContainer && typesContainer.children.length === 0){
      typesContainer.appendChild(createTypeRow())
    }

    const active = document.activeElement
    const activeIsVolume = active && active.classList && active.classList.contains('type-volume')
    const isActiveInsideTypes = activeIsVolume && typesContainer && typesContainer.contains(active)

    const firstRowVolume = typesContainer
      ? typesContainer.querySelector('.type-row .type-volume')
      : document.querySelector('.type-row .type-volume')

    const target = isActiveInsideTypes ? active : firstRowVolume
    if(!target) return
    target.value = v.toFixed(2)
    target.classList.remove('is-invalid')
  }

  function setVisible(el, visible){
    if(!el) return
    el.style.display = visible ? '' : 'none'
  }

  function clearInvalidFoundationInputs(){
    ;[foundationLength, foundationWidth, foundationHeight, slabArea, slabThickness, pileRadius, pileHeight]
      .filter(Boolean)
      .forEach(inp=> inp.classList.remove('is-invalid'))
  }

  function getFoundationKind(){
    const raw = foundationType ? String(foundationType.value || '').trim() : 'strip'
    if(raw === 'strip' || raw === 'slab' || raw === 'piles') return raw
    return 'strip'
  }

  function setFoundationKind(kind){
    const k = (kind === 'strip' || kind === 'slab' || kind === 'piles') ? kind : 'strip'
    if(foundationType) foundationType.value = k

    // tabs
    foundationTabs.forEach(btn=>{
      const isActive = String(btn.dataset.kind || '') === k
      btn.classList.toggle('is-active', isActive)
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false')
      btn.tabIndex = isActive ? 0 : -1
    })

    // panels
    setVisible(foundationFieldsStrip, k === 'strip')
    setVisible(foundationFieldsSlab, k === 'slab')
    setVisible(foundationFieldsPiles, k === 'piles')

    if(foundationFormula){
      if(k === 'strip') foundationFormula.textContent = 'Формула: V = L × W × H (в метрах).'
      else if(k === 'slab') foundationFormula.textContent = 'Формула: V = S × h (S — площадь плиты, h — толщина плиты).'
      else foundationFormula.textContent = 'Формула: V = π × r² × h (π = 3,14; r — радиус; h — глубина/высота сваи).'
    }

    clearInvalidFoundationInputs()
    if(volumeResult) volumeResult.textContent = '—'
  }

  // hook tabs
  if(foundationTabs.length){
    foundationTabs.forEach(btn=>{
      btn.addEventListener('click', ()=> setFoundationKind(String(btn.dataset.kind || 'strip')))
    })
  }

  // init
  setFoundationKind(getFoundationKind())

  if(volumeCalcBtn && volumeResult){
    volumeCalcBtn.addEventListener('click', ()=>{
      clearInvalidFoundationInputs()
      const kind = getFoundationKind()

      if(kind === 'strip'){
        if(!foundationLength || !foundationWidth || !foundationHeight){ volumeResult.textContent = '—'; return }
        const l = parseLocaleNumber(foundationLength.value)
        const w = parseLocaleNumber(foundationWidth.value)
        const h = parseLocaleNumber(foundationHeight.value)

        const invalidL = (!isFinite(l) || l <= 0)
        const invalidW = (!isFinite(w) || w <= 0)
        const invalidH = (!isFinite(h) || h <= 0)

        foundationLength.classList.toggle('is-invalid', invalidL)
        foundationWidth.classList.toggle('is-invalid', invalidW)
        foundationHeight.classList.toggle('is-invalid', invalidH)

        if(invalidL || invalidW || invalidH){ volumeResult.textContent = '—'; return }
        const v = roundTo(l*w*h, 2)
        volumeResult.textContent = `Объём: ${formatM3(v)} м³`
        setConcreteVolumeFromFoundation(v)
        return
      }

      if(kind === 'slab'){
        if(!slabArea || !slabThickness){ volumeResult.textContent = '—'; return }
        const s = parseLocaleNumber(slabArea.value)
        const h = parseLocaleNumber(slabThickness.value)
        const invalidS = (!isFinite(s) || s <= 0)
        const invalidH = (!isFinite(h) || h <= 0)
        slabArea.classList.toggle('is-invalid', invalidS)
        slabThickness.classList.toggle('is-invalid', invalidH)
        if(invalidS || invalidH){ volumeResult.textContent = '—'; return }
        const v = roundTo(s*h, 2)
        volumeResult.textContent = `Объём: ${formatM3(v)} м³`
        setConcreteVolumeFromFoundation(v)
        return
      }

      // piles
      if(!pileRadius || !pileHeight){ volumeResult.textContent = '—'; return }
      const r = parseLocaleNumber(pileRadius.value)
      const h = parseLocaleNumber(pileHeight.value)
      const invalidR = (!isFinite(r) || r <= 0)
      const invalidH = (!isFinite(h) || h <= 0)
      pileRadius.classList.toggle('is-invalid', invalidR)
      pileHeight.classList.toggle('is-invalid', invalidH)
      if(invalidR || invalidH){ volumeResult.textContent = '—'; return }
      const pi = 3.14
      const v = roundTo(pi * r * r * h, 2)
      volumeResult.textContent = `Объём: ${formatM3(v)} м³`
      setConcreteVolumeFromFoundation(v)
    })
  }

  if(volumeClearBtn && volumeResult){
    volumeClearBtn.addEventListener('click', ()=>{
      ;[foundationLength, foundationWidth, foundationHeight, slabArea, slabThickness, pileRadius, pileHeight]
        .filter(Boolean)
        .forEach(inp=>{ inp.value = ''; inp.classList.remove('is-invalid') })
      volumeResult.textContent = '—'
    })
  }

  if(addTypeBtn && typesContainer){
    addTypeBtn.addEventListener('click', ()=>{
      typesContainer.appendChild(createTypeRow())
      // scroll add button into view if needed
      addTypeBtn.scrollIntoView({behavior:'smooth', block:'center'})
    })
  }

  // submit order: build markdown table with rows
  if(submitOrderBtn){
    submitOrderBtn.addEventListener('click', async ()=>{
      const buyerNameEl = document.getElementById('buyerName')
      const buyerPhoneEl = document.getElementById('buyerPhone')
      const buyerEmailEl = document.getElementById('buyerEmail')

      const buyerName = buyerNameEl ? String(buyerNameEl.value || '') : ''
      const buyerPhone = buyerPhoneEl ? String(buyerPhoneEl.value || '') : ''
      const buyerEmail = buyerEmailEl ? String(buyerEmailEl.value || '') : ''

      const badName = !isValidBuyerName(buyerName)
      const badPhone = !isValidBuyerPhone(buyerPhone)
      const badEmail = !isValidBuyerEmail(buyerEmail)

      setInvalid(buyerNameEl, badName)
      setInvalid(buyerPhoneEl, badPhone)
      setInvalid(buyerEmailEl, badEmail)

      if(badName || badPhone || badEmail){
        const parts = []
        if(badName) parts.push('Имя: минимум 2 символа')
        if(badPhone) parts.push('Телефон: начинается с +7 или 8 и содержит 11 цифр')
        if(badEmail) parts.push('Email: неверный формат')
        alert(parts.join('\n'))
        return
      }

  const res = computeTotals()
  if(res.error){ alert(res.error); return }
  const {details, materialTotal, delivery, total, km} = res

      // markdown table lines
      const lines = []
      lines.push('| № | Тип | Класс/марка | Объём (м³) | Цена/м³ | Стоимость |')
      lines.push('|---:|---|---|---:|---:|---:|')
      details.forEach((d,i)=>{
        const frostPart = d.frost ? ` (F${d.frost})` : ''
        lines.push(`| ${i+1} | ${d.type} | ${d.mark}${frostPart} | ${formatM3(d.vol)} | ${formatPrice(d.price)} ₽ | ${formatPrice(d.cost)} ₽ |`)
      })
      lines.push('')
      lines.push(`**Материал:** ${formatPrice(materialTotal)} ₽`)
      lines.push(`**Доставка (${km} км):** ${formatPrice(delivery)} ₽`)
      lines.push(`**Итог:** ${formatPrice(total)} ₽`)
      lines.push('')
      lines.push(`**Покупатель:** ${buyerName}`)
      lines.push(`**Телефон:** ${buyerPhone}`)
      lines.push(`**Email:** ${buyerEmail}`)

      const md = lines.join('\n')

      submitStatus.textContent = 'Отправка...'
      try{
        const url = apiUrl('/api/order')
        const resp = await fetch(url, {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ markdown: md, order:{details, materialTotal, delivery, total, km, buyerName, buyerPhone, buyerEmail} })
        })
        if(!resp.ok){
          const text = await resp.text().catch(()=> '')
          throw new Error(`HTTP ${resp.status} ${resp.statusText} при запросе ${url}\n${text}`)
        }
        const data = await resp.json().catch(()=>null)
        if(data && data.email && data.email.attempted && !data.email.sent){
          submitStatus.textContent = 'Заказ сохранён, но письмо не отправлено.'
          alert('Заказ сохранён на сервере, но письмо не отправилось.\nПричина: ' + (data.email.error || 'unknown'))
        } else {
          submitStatus.textContent = 'Отправлено — проверьте почту предприятия.'
        }
      }catch(err){
        console.error(err)
        submitStatus.textContent = 'Ошибка отправки (см. консоль)'
        alert('Ошибка отправки заказа. Сервер может быть не запущен или неверные настройки почты/сети.\n' + err.message)
      }
    })
  }

  // contact form submit
  const contactForm = document.getElementById('contactForm')
  const contactStatus = document.getElementById('contactStatus')
  if(contactForm){
    contactForm.addEventListener('submit', async (e)=>{
      e.preventDefault()
      if(contactStatus) contactStatus.textContent = 'Отправка...'
      try{
        const fd = new FormData(contactForm)
        const payload = Object.fromEntries(fd.entries())
        const url = apiUrl('/sendform')
        const resp = await fetch(url, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        })
        const data = await resp.json().catch(()=>null)
        if(resp.ok && data && data.ok){
          if(contactStatus) contactStatus.textContent = 'Отправлено.'
          contactForm.reset()
          return
        }
        if(!resp.ok){
          const text = await resp.text().catch(()=> '')
          throw new Error(`HTTP ${resp.status} ${resp.statusText} при запросе ${url}\n${text}`)
        }
        const msg = (data && (data.error || data.message)) ? String(data.error || data.message) : 'Не удалось отправить'
        if(contactStatus) contactStatus.textContent = 'Ошибка отправки'
        alert('Сообщение сохранено на сервере, но не отправлено на почту.\nПричина: ' + msg)
      }catch(err){
        console.error(err)
        if(contactStatus) contactStatus.textContent = 'Ошибка'
        alert('Ошибка отправки формы.\n' + err.message)
      }
    })
  }

  // --- Admin modal actions (keep previous behavior) ---
  const adminBtn = document.getElementById('openAdmin')
  const adminModal = document.getElementById('adminModal')
  const closeAdmin = document.getElementById('closeAdmin')
  if(adminBtn && adminModal){ adminBtn.addEventListener('click',()=>{adminModal.style.display='block'}) }
  if(closeAdmin){ closeAdmin.addEventListener('click',()=>{adminModal.style.display='none'}) }

  const authBtn = document.getElementById('authBtn')
  if(authBtn){
    authBtn.addEventListener('click',()=>{
      const pass = document.getElementById('adminPass').value
      if(pass==='admin123'){
        document.getElementById('adminArea').style.display='block'
        document.getElementById('adminPass').value=''
        renderAdminTable()
        document.getElementById('mapSrc').value = appData.mapSrc
      }else{alert('Неверный пароль')}
    })
  }

  function renderAdminTable(){
    const tbody = document.querySelector('#adminTable tbody')
    if(!tbody) return
    tbody.innerHTML=''
    appData.prices.forEach((p,idx)=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${p.mark}</td><td>${p.price}</td><td><button data-idx="${idx}" class="del">Удалить</button></td>`
      tbody.appendChild(tr)
    })
    tbody.querySelectorAll('.del').forEach(b=>b.addEventListener('click',e=>{
      const idx = +e.target.dataset.idx
      appData.prices.splice(idx,1)
      saveData(appData)
      renderAdminTable()
      renderPriceTable()
    }))
  }

  const addPriceBtn = document.getElementById('addPrice')
  if(addPriceBtn){
    addPriceBtn.addEventListener('click',()=>{
      const mark = document.getElementById('newMark').value.trim()
      const price = parseInt(document.getElementById('newPrice').value,10)
      if(!mark||!price){alert('Введите марку и цену') ; return}
      appData.prices.push({mark,price})
      saveData(appData)
      document.getElementById('newMark').value=''
      document.getElementById('newPrice').value=''
      renderAdminTable(); renderPriceTable()
    })
  }

  const exportBtn = document.getElementById('exportJson')
  if(exportBtn){
    exportBtn.addEventListener('click',()=>{
      const blob = new Blob([JSON.stringify(appData,null,2)],{type:'application/json'})
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='prices.json'; a.click(); URL.revokeObjectURL(url)
    })
  }

  const importFile = document.getElementById('importFile')
  if(importFile){
    importFile.addEventListener('change',async(e)=>{
      const f = e.target.files[0]
      if(!f) return
      try{
        const txt = await f.text()
        const parsed = JSON.parse(txt)
        if(parsed.prices){appData = parsed; saveData(appData); renderAdminTable(); renderPriceTable(); alert('Импорт выполнен')}
        else alert('Неверный формат')
      }catch(err){alert('Ошибка чтения файла')}
    })
  }

  const saveMapBtn = document.getElementById('saveMap')
  if(saveMapBtn){
    saveMapBtn.addEventListener('click',()=>{
      const v = document.getElementById('mapSrc').value.trim()
      if(!v){alert('Введите ссылку для iframe') ; return}
      appData.mapSrc = v
      const mapFrame = document.getElementById('mapFrame')
      if(mapFrame) mapFrame.src = v
      saveData(appData)
      alert('Сохранено')
    })
  }

  // --- Init ---
  renderPriceTable()
  loadPriceCatalog().then(()=>hydrateAllTypeRows())
  ensureInitialType()

  // About page: secondary info from the same JSON
  const aboutSecondary = document.getElementById('aboutSecondaryInfo')
  if(aboutSecondary){
    loadConcretePriceInfo().then(data=>{
      if(data) renderAboutSecondaryInfo(data, aboutSecondary)
      else aboutSecondary.innerHTML = '<div class="small">Информация временно недоступна.</div>'
    })
  }

  // Main page: move dispatcher/lab contacts from price into "Контакты"
  const mainContactsExtra = document.getElementById('mainContactsExtra')
  if(mainContactsExtra){
    loadConcretePriceInfo().then(data=>{
      if(data) renderMainExtraContacts(data, mainContactsExtra)
    })
  }

  // Main page: company card (phone/address/requisites) from one JSON
  if(document.getElementById('companyRequisites') || document.getElementById('topCompanyRequisites') || document.getElementById('headerPhoneLink')){
    loadCompanyInfo().then(company=>{
      if(company) renderCompanyContactsOnMainPage(company)
    })
  }
});
