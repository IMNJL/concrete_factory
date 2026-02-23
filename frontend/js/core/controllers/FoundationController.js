import { DomUtils, NumberUtils } from '../utils.js'

export class FoundationController {
  constructor(typeRowsController) {
    this.typeRowsController = typeRowsController

    this.volumeResult = document.getElementById('volumeResult')
    this.foundationType = document.getElementById('foundationType')
    this.foundationFormula = document.getElementById('foundationFormula')
    this.foundationTabs = Array.from(document.querySelectorAll('.foundation-tab'))

    this.panels = {
      strip: document.getElementById('foundationFieldsStrip'),
      slab: document.getElementById('foundationFieldsSlab'),
      piles: document.getElementById('foundationFieldsPiles'),
    }

    this.inputs = {
      foundationLength: document.getElementById('foundationLength'),
      foundationWidth: document.getElementById('foundationWidth'),
      foundationHeight: document.getElementById('foundationHeight'),
      slabArea: document.getElementById('slabArea'),
      slabThickness: document.getElementById('slabThickness'),
      pileRadius: document.getElementById('pileRadius'),
      pileHeight: document.getElementById('pileHeight'),
    }
  }

  init() {
    if (!this.foundationType) return

    this.foundationTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.setFoundationKind(String(tab.dataset.kind || 'strip'))
      })
    })

    this.setFoundationKind(this.getFoundationKind())

    const calcButton = document.getElementById('volumeCalcBtn')
    const clearButton = document.getElementById('volumeClearBtn')

    if (calcButton) calcButton.addEventListener('click', () => this.calculate())
    if (clearButton) clearButton.addEventListener('click', () => this.clear())

    this.initNumericInputs()
  }

  initNumericInputs() {
    Object.values(this.inputs).filter(Boolean).forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (this.isAllowedNumericKey(event, input)) return
        event.preventDefault()
      })

      input.addEventListener('input', () => {
        const sanitized = this.sanitizeDecimalInput(input.value)
        if (input.value !== sanitized) input.value = sanitized
        input.classList.remove('is-invalid')
      })

      input.addEventListener('paste', (event) => {
        event.preventDefault()
        const text = event.clipboardData ? event.clipboardData.getData('text') : ''
        input.value = this.sanitizeDecimalInput(text)
        input.classList.remove('is-invalid')
      })
    })
  }

  isAllowedNumericKey(event, input) {
    if (event.ctrlKey || event.metaKey || event.altKey) return true
    const key = event.key

    const editKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Tab']
    if (editKeys.includes(key)) return true

    if (/^\d$/.test(key)) return true

    if (key === '.' || key === ',') {
      const value = String(input.value || '')
      return !value.includes('.') && !value.includes(',')
    }

    return false
  }

  sanitizeDecimalInput(rawValue) {
    let value = String(rawValue ?? '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '')

    const firstDot = value.indexOf('.')
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '')
    }

    if (value.startsWith('.')) value = `0${value}`
    return value
  }

  clearInvalid() {
    Object.values(this.inputs).filter(Boolean).forEach((input) => input.classList.remove('is-invalid'))
  }

  getFoundationKind() {
    const raw = this.foundationType ? String(this.foundationType.value || '').trim() : 'strip'
    if (raw === 'strip' || raw === 'slab' || raw === 'piles') return raw
    return 'strip'
  }

  setFoundationKind(kind) {
    const next = (kind === 'strip' || kind === 'slab' || kind === 'piles') ? kind : 'strip'
    if (this.foundationType) this.foundationType.value = next

    this.foundationTabs.forEach((tab) => {
      const active = String(tab.dataset.kind || '') === next
      tab.classList.toggle('is-active', active)
      tab.setAttribute('aria-selected', active ? 'true' : 'false')
      tab.tabIndex = active ? 0 : -1
    })

    DomUtils.setVisible(this.panels.strip, next === 'strip')
    DomUtils.setVisible(this.panels.slab, next === 'slab')
    DomUtils.setVisible(this.panels.piles, next === 'piles')

    if (this.foundationFormula) {
      if (next === 'strip') this.foundationFormula.textContent = 'Формула: V = L × W × H (в метрах).'
      else if (next === 'slab') this.foundationFormula.textContent = 'Формула: V = S × h (S — площадь плиты, h — толщина плиты).'
      else this.foundationFormula.textContent = 'Формула: V = π × r² × h (π = 3,14; r — радиус; h — глубина/высота сваи).'
    }

    this.clearInvalid()
    if (this.volumeResult) this.volumeResult.textContent = '—'
  }

  calculate() {
    this.clearInvalid()
    const kind = this.getFoundationKind()

    if (kind === 'strip') {
      const l = NumberUtils.parseLocaleNumber(this.inputs.foundationLength?.value)
      const w = NumberUtils.parseLocaleNumber(this.inputs.foundationWidth?.value)
      const h = NumberUtils.parseLocaleNumber(this.inputs.foundationHeight?.value)

      const invalidL = !Number.isFinite(l) || l <= 0
      const invalidW = !Number.isFinite(w) || w <= 0
      const invalidH = !Number.isFinite(h) || h <= 0

      DomUtils.setInvalid(this.inputs.foundationLength, invalidL)
      DomUtils.setInvalid(this.inputs.foundationWidth, invalidW)
      DomUtils.setInvalid(this.inputs.foundationHeight, invalidH)

      if (invalidL || invalidW || invalidH) {
        if (this.volumeResult) this.volumeResult.textContent = '—'
        return
      }

      const volume = NumberUtils.roundTo(l * w * h, 2)
      if (this.volumeResult) this.volumeResult.textContent = `Объём: ${NumberUtils.formatM3(volume)} м³`
      this.typeRowsController.setFirstVolume(volume)
      return
    }

    if (kind === 'slab') {
      const s = NumberUtils.parseLocaleNumber(this.inputs.slabArea?.value)
      const h = NumberUtils.parseLocaleNumber(this.inputs.slabThickness?.value)

      const invalidS = !Number.isFinite(s) || s <= 0
      const invalidH = !Number.isFinite(h) || h <= 0

      DomUtils.setInvalid(this.inputs.slabArea, invalidS)
      DomUtils.setInvalid(this.inputs.slabThickness, invalidH)

      if (invalidS || invalidH) {
        if (this.volumeResult) this.volumeResult.textContent = '—'
        return
      }

      const volume = NumberUtils.roundTo(s * h, 2)
      if (this.volumeResult) this.volumeResult.textContent = `Объём: ${NumberUtils.formatM3(volume)} м³`
      this.typeRowsController.setFirstVolume(volume)
      return
    }

    const r = NumberUtils.parseLocaleNumber(this.inputs.pileRadius?.value)
    const h = NumberUtils.parseLocaleNumber(this.inputs.pileHeight?.value)

    const invalidR = !Number.isFinite(r) || r <= 0
    const invalidH = !Number.isFinite(h) || h <= 0

    DomUtils.setInvalid(this.inputs.pileRadius, invalidR)
    DomUtils.setInvalid(this.inputs.pileHeight, invalidH)

    if (invalidR || invalidH) {
      if (this.volumeResult) this.volumeResult.textContent = '—'
      return
    }

    const volume = NumberUtils.roundTo(3.14 * r * r * h, 2)
    if (this.volumeResult) this.volumeResult.textContent = `Объём: ${NumberUtils.formatM3(volume)} м³`
    this.typeRowsController.setFirstVolume(volume)
  }

  clear() {
    Object.values(this.inputs).filter(Boolean).forEach((input) => {
      input.value = ''
      input.classList.remove('is-invalid')
    })

    if (this.volumeResult) this.volumeResult.textContent = '—'
  }
}
