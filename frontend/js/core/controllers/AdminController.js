import { TextUtils } from '../utils.js'

export class AdminController {
  constructor(getAppData, setAppData, onDataChanged, onPriceDataChanged, contentService) {
    this.getAppData = getAppData
    this.setAppData = setAppData
    this.onDataChanged = onDataChanged
    this.onPriceDataChanged = onPriceDataChanged
    this.contentService = contentService

    this.modal = document.getElementById('adminModal')
    this.area = document.getElementById('adminArea')
    this.status = document.getElementById('adminStatus')
    this.sectionSelect = document.getElementById('adminSection')

    this.concreteData = null
  }

  init() {
    const openBtn = document.getElementById('openAdmin')
    const closeBtn = document.getElementById('closeAdmin')
    const closeBottomBtn = document.getElementById('closeAdminBottom')
    const authBtn = document.getElementById('authBtn')
    const addPriceBtn = document.getElementById('addPrice')
    const exportBtn = document.getElementById('exportCsv')
    const importFile = document.getElementById('importFile')
    const saveMapBtn = document.getElementById('saveMap')

    if (openBtn && this.modal) openBtn.addEventListener('click', () => this.openModal())
    if (closeBtn && this.modal) closeBtn.addEventListener('click', () => this.closeModal())
    if (closeBottomBtn && this.modal) closeBottomBtn.addEventListener('click', () => this.closeModal())

    if (this.sectionSelect) {
      this.sectionSelect.addEventListener('change', () => this.renderAdminTable())
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal()
      })
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal.classList.contains('is-open')) this.closeModal()
      })
    }

    if (authBtn) authBtn.addEventListener('click', () => this.authorize())
    if (addPriceBtn) addPriceBtn.addEventListener('click', () => this.addPrice())
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportCsv())
    if (importFile) importFile.addEventListener('change', (e) => this.importCsv(e))
    if (saveMapBtn) saveMapBtn.addEventListener('click', () => this.saveMap())
  }

  openModal() {
    if (!this.modal) return
    this.modal.classList.add('is-open')
    if (this.status) this.status.textContent = ''
  }

  closeModal() {
    if (!this.modal) return
    this.modal.classList.remove('is-open')
  }

  async ensureConcreteData() {
    if (this.concreteData) return this.concreteData

    const loaded = await this.contentService.loadConcretePriceInfo()
    if (loaded && Array.isArray(loaded.sections)) {
      this.concreteData = loaded
      return this.concreteData
    }

    const fallback = this.getAppData()
    this.concreteData = {
      meta: { title: 'Прайс-лист' },
      contacts: {},
      sections: [{
        type: 'table',
        title: 'Бетон',
        columns: [
          { key: 'mark', label: 'Марка' },
          { key: 'price', label: 'Цена' },
          { key: 'priceVat', label: 'с НДС' },
        ],
        rows: (fallback.prices || []).map((item) => ({ mark: item.mark, price: Number(item.price), priceVat: Number(item.price) })),
      }],
      notes: {},
    }
    return this.concreteData
  }

  getTableSections() {
    const sections = Array.isArray(this.concreteData?.sections) ? this.concreteData.sections : []
    return sections.filter((section) => section && section.type === 'table')
  }

  renderSectionOptions() {
    if (!this.sectionSelect) return
    const sections = this.getTableSections()
    const current = this.sectionSelect.value

    this.sectionSelect.innerHTML = ''
    sections.forEach((section, idx) => {
      const option = document.createElement('option')
      option.value = String(idx)
      option.textContent = section.title || `Раздел ${idx + 1}`
      this.sectionSelect.appendChild(option)
    })

    if (sections.length === 0) return
    if (current && sections[Number(current)]) this.sectionSelect.value = current
    else this.sectionSelect.value = '0'
  }

  async authorize() {
    const pass = document.getElementById('adminPass')
    const mapSrc = document.getElementById('mapSrc')
    if (!pass || !this.area) return

    if (pass.value === 'admin123') {
      await this.ensureConcreteData()
      this.area.classList.remove('is-hidden')
      pass.value = ''
      this.renderSectionOptions()
      this.renderAdminTable()
      if (mapSrc) mapSrc.value = this.getAppData().mapSrc || ''
      if (this.status) this.status.textContent = 'Доступ открыт'
      return
    }

    if (this.status) this.status.textContent = 'Неверный пароль'
    alert('Неверный пароль')
  }

  getSelectedSectionIndex() {
    if (!this.sectionSelect) return 0
    const idx = Number(this.sectionSelect.value)
    return Number.isFinite(idx) ? idx : 0
  }

  renderAdminTable() {
    const tbody = document.querySelector('#adminTable tbody')
    if (!tbody) return

    tbody.innerHTML = ''
    const sections = this.getTableSections()
    const sectionIndex = this.getSelectedSectionIndex()
    const section = sections[sectionIndex]
    if (!section) return

    const rows = Array.isArray(section.rows) ? section.rows : []
    rows.forEach((row, rowIndex) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${TextUtils.escapeHtml(row.mark || '')}</td>
        <td>${TextUtils.escapeHtml(row.frost || '')}</td>
        <td>${TextUtils.escapeHtml(row.price ?? '')}</td>
        <td>${TextUtils.escapeHtml(row.priceVat ?? '')}</td>
        <td><button type="button" data-row-idx="${rowIndex}" class="admin-del">Удалить</button></td>
      `.trim()
      tbody.appendChild(tr)
    })

    tbody.querySelectorAll('.admin-del').forEach((button) => {
      button.addEventListener('click', (e) => {
        const rowIndex = Number(e.target.dataset.rowIdx)
        const sec = this.getTableSections()[this.getSelectedSectionIndex()]
        if (!sec || !Array.isArray(sec.rows)) return
        sec.rows.splice(rowIndex, 1)
        this.persistConcreteData()
        this.renderAdminTable()
      })
    })
  }

  addPrice() {
    const markEl = document.getElementById('newMark')
    const frostEl = document.getElementById('newFrost')
    const priceEl = document.getElementById('newPrice')
    const priceVatEl = document.getElementById('newPriceVat')
    if (!markEl || !priceEl || !priceVatEl) return

    const mark = markEl.value.trim()
    const frost = frostEl ? frostEl.value.trim() : ''
    const price = Number(String(priceEl.value || '').replace(',', '.'))
    const priceVat = Number(String(priceVatEl.value || '').replace(',', '.'))

    if (!mark || !Number.isFinite(price) || !Number.isFinite(priceVat)) {
      alert('Введите корректные значения: марка, цена, с НДС')
      return
    }

    const section = this.getTableSections()[this.getSelectedSectionIndex()]
    if (!section) return

    if (!Array.isArray(section.rows)) section.rows = []
    section.rows.push({ mark, ...(frost ? { frost } : {}), price: Math.round(price), priceVat: Math.round(priceVat) })

    markEl.value = ''
    if (frostEl) frostEl.value = ''
    priceEl.value = ''
    priceVatEl.value = ''

    this.persistConcreteData()
    this.renderAdminTable()
  }

  exportCsv() {
    const sections = this.getTableSections()
    const lines = ['section;mark;frost;price;priceVat']

    sections.forEach((section) => {
      const title = section.title || ''
      const rows = Array.isArray(section.rows) ? section.rows : []
      rows.forEach((row) => {
        lines.push([
          this.escapeCsvCell(title),
          this.escapeCsvCell(row.mark || ''),
          this.escapeCsvCell(row.frost || ''),
          this.escapeCsvCell(row.price ?? ''),
          this.escapeCsvCell(row.priceVat ?? ''),
        ].join(';'))
      })
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'concrete-price-sections.csv'
    link.click()
    URL.revokeObjectURL(url)
    if (this.status) this.status.textContent = 'CSV выгружен'
  }

  async importCsv(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null
    if (!file) return

    try {
      const text = await file.text()
      const grouped = this.parseSectionedCsv(text)
      if (grouped.length === 0) {
        if (this.status) this.status.textContent = 'Файл пустой или неверного формата'
        alert('Неверный формат')
        return
      }

      const sectionMap = new Map(grouped.map((item) => [item.title, item.rows]))
      const sections = this.getTableSections()

      sections.forEach((section) => {
        const key = section.title || ''
        if (sectionMap.has(key)) section.rows = sectionMap.get(key)
      })

      grouped.forEach((item) => {
        if (sections.find((section) => (section.title || '') === item.title)) return
        sections.push({
          type: 'table',
          title: item.title,
          columns: [
            { key: 'mark', label: 'Марка' },
            { key: 'frost', label: 'F' },
            { key: 'price', label: 'Цена' },
            { key: 'priceVat', label: 'с НДС' },
          ],
          rows: item.rows,
        })
      })

      this.persistConcreteData()
      this.renderSectionOptions()
      this.renderAdminTable()
      if (this.status) this.status.textContent = 'CSV загружен'
      alert('Импорт CSV выполнен')
    } catch (_) {
      if (this.status) this.status.textContent = 'Ошибка чтения CSV'
      alert('Ошибка чтения файла')
    } finally {
      if (event.target) event.target.value = ''
    }
  }

  escapeCsvCell(value) {
    const text = String(value ?? '')
    if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }

  parseSectionedCsv(text) {
    const rows = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const grouped = new Map()

    rows.forEach((line, idx) => {
      const separator = line.includes(';') ? ';' : ','
      const parts = line.split(separator).map((item) => item.trim().replace(/^"|"$/g, ''))
      if (parts.length < 5) return

      const section = parts[0]
      const mark = parts[1]
      const frost = parts[2]
      const price = Number(parts[3].replace(',', '.'))
      const priceVat = Number(parts[4].replace(',', '.'))

      const isHeader = idx === 0 && /section/i.test(section) && /mark|марка/i.test(mark)
      if (isHeader) return
      if (!section || !mark || !Number.isFinite(price) || !Number.isFinite(priceVat)) return

      if (!grouped.has(section)) grouped.set(section, [])
      grouped.get(section).push({ mark, ...(frost ? { frost } : {}), price: Math.round(price), priceVat: Math.round(priceVat) })
    })

    return Array.from(grouped.entries()).map(([title, sectionRows]) => ({ title, rows: sectionRows }))
  }

  persistConcreteData() {
    this.contentService.saveConcretePriceInfoOverride(this.concreteData)
    this.onPriceDataChanged()
    if (this.status) this.status.textContent = 'Прайс обновлён'
  }

  saveMap() {
    const mapSrcInput = document.getElementById('mapSrc')
    const mapFrame = document.getElementById('mapFrame')
    if (!mapSrcInput) return

    const src = mapSrcInput.value.trim()
    if (!src) {
      alert('Введите ссылку для iframe')
      return
    }

    const next = this.getAppData()
    next.mapSrc = src
    this.setAppData(next)
    this.onDataChanged()

    if (mapFrame) mapFrame.src = src
    if (this.status) this.status.textContent = 'Ссылка карты сохранена'
    alert('Сохранено')
  }
}
