import { TextUtils } from '../utils.js'

export class AdminController {
  constructor(getAppData, setAppData, onDataChanged, onPriceDataChanged) {
    this.getAppData = getAppData
    this.setAppData = setAppData
    this.onDataChanged = onDataChanged
    this.onPriceDataChanged = onPriceDataChanged

    this.modal = document.getElementById('adminModal')
    this.area = document.getElementById('adminArea')
  }

  init() {
    const openBtn = document.getElementById('openAdmin')
    const closeBtn = document.getElementById('closeAdmin')
    const authBtn = document.getElementById('authBtn')
    const addPriceBtn = document.getElementById('addPrice')
    const exportBtn = document.getElementById('exportJson')
    const importFile = document.getElementById('importFile')
    const saveMapBtn = document.getElementById('saveMap')

    if (openBtn && this.modal) {
      openBtn.addEventListener('click', () => this.modal.classList.add('is-open'))
    }

    if (closeBtn && this.modal) {
      closeBtn.addEventListener('click', () => this.modal.classList.remove('is-open'))
    }

    if (authBtn) authBtn.addEventListener('click', () => this.authorize())
    if (addPriceBtn) addPriceBtn.addEventListener('click', () => this.addPrice())
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportJson())
    if (importFile) importFile.addEventListener('change', (e) => this.importJson(e))
    if (saveMapBtn) saveMapBtn.addEventListener('click', () => this.saveMap())
  }

  authorize() {
    const pass = document.getElementById('adminPass')
    const mapSrc = document.getElementById('mapSrc')
    if (!pass || !this.area) return

    if (pass.value === 'admin123') {
      this.area.classList.remove('is-hidden')
      pass.value = ''
      this.renderAdminTable()
      if (mapSrc) mapSrc.value = this.getAppData().mapSrc || ''
      return
    }

    alert('Неверный пароль')
  }

  renderAdminTable() {
    const tbody = document.querySelector('#adminTable tbody')
    if (!tbody) return

    tbody.innerHTML = ''
    const appData = this.getAppData()

    appData.prices.forEach((price, index) => {
      const row = document.createElement('tr')
      row.innerHTML = `<td>${TextUtils.escapeHtml(price.mark)}</td><td>${TextUtils.escapeHtml(price.price)}</td><td><button type="button" data-idx="${index}" class="admin-del">Удалить</button></td>`
      tbody.appendChild(row)
    })

    tbody.querySelectorAll('.admin-del').forEach((button) => {
      button.addEventListener('click', (e) => {
        const index = Number(e.target.dataset.idx)
        const next = this.getAppData()
        next.prices.splice(index, 1)
        this.setAppData(next)
        this.onDataChanged()
        this.onPriceDataChanged()
        this.renderAdminTable()
      })
    })
  }

  addPrice() {
    const markEl = document.getElementById('newMark')
    const priceEl = document.getElementById('newPrice')
    if (!markEl || !priceEl) return

    const mark = markEl.value.trim()
    const price = parseInt(priceEl.value, 10)
    if (!mark || !price) {
      alert('Введите марку и цену')
      return
    }

    const next = this.getAppData()
    next.prices.push({ mark, price })

    markEl.value = ''
    priceEl.value = ''

    this.setAppData(next)
    this.onDataChanged()
    this.onPriceDataChanged()
    this.renderAdminTable()
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.getAppData(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'prices.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async importJson(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed.prices) {
        alert('Неверный формат')
        return
      }

      this.setAppData(parsed)
      this.onDataChanged()
      this.onPriceDataChanged()
      this.renderAdminTable()
      alert('Импорт выполнен')
    } catch (_) {
      alert('Ошибка чтения файла')
    }
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
    alert('Сохранено')
  }
}
