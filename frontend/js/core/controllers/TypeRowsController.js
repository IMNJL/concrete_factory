import { NumberUtils } from '../utils.js'

export class TypeRowsController {
  constructor(priceCatalogService) {
    this.priceCatalogService = priceCatalogService
    this.container = document.getElementById('typesContainer')
  }

  init() {
    if (!this.container) return
    if (this.container.children.length === 0) {
      this.container.appendChild(this.createTypeRow())
    }
  }

  createTypeRow(typeKey = '', variantId = '', volume = 1) {
    const wrapper = document.createElement('div')
    wrapper.className = 'type-row'

    const kindSelect = document.createElement('select')
    kindSelect.className = 'type-kind'

    const variantSelect = document.createElement('select')
    variantSelect.className = 'type-variant'

    const volumeInput = document.createElement('input')
    volumeInput.type = 'number'
    volumeInput.min = '0'
    volumeInput.step = '0.01'
    volumeInput.value = Number.isFinite(Number(volume)) ? Number(volume).toFixed(2) : '1.00'
    volumeInput.className = 'type-volume'

    const removeButton = document.createElement('button')
    removeButton.type = 'button'
    removeButton.textContent = '✕'
    removeButton.title = 'Удалить'
    removeButton.className = 'type-remove-btn'

    removeButton.addEventListener('click', () => wrapper.remove())

    volumeInput.addEventListener('input', () => {
      const raw = String(volumeInput.value || '').trim()
      if (!raw) {
        volumeInput.classList.remove('is-invalid')
        return
      }
      const value = NumberUtils.parseLocaleNumber(raw)
      volumeInput.classList.toggle('is-invalid', !Number.isFinite(value) || !(value > 0))
    })

    kindSelect.addEventListener('change', async () => {
      const catalog = await this.priceCatalogService.getCatalog()
      this.priceCatalogService.populateVariantOptions(variantSelect, catalog, kindSelect.value)
    })

    wrapper.appendChild(kindSelect)
    wrapper.appendChild(variantSelect)
    wrapper.appendChild(volumeInput)
    wrapper.appendChild(removeButton)

    this.priceCatalogService.getCatalog().then((catalog) => {
      this.priceCatalogService.populateTypeOptions(kindSelect, catalog)
      if (typeKey && catalog.typesByKey[typeKey]) kindSelect.value = typeKey

      const effectiveTypeKey = kindSelect.value || (catalog.types[0] && catalog.types[0].key)
      if (effectiveTypeKey) this.priceCatalogService.populateVariantOptions(variantSelect, catalog, effectiveTypeKey)

      if (variantId && catalog.itemsById[variantId]) {
        const item = catalog.itemsById[variantId]
        if (item && item.typeKey === effectiveTypeKey) variantSelect.value = variantId
      }
    })

    return wrapper
  }

  hydrateAllRows() {
    const rows = Array.from(document.querySelectorAll('.type-row'))
    if (rows.length === 0) return

    this.priceCatalogService.getCatalog().then((catalog) => {
      rows.forEach((row) => {
        const kind = row.querySelector('.type-kind')
        const variant = row.querySelector('.type-variant')
        if (!kind || !variant) return

        const prevKind = kind.value
        const prevVariant = variant.value

        this.priceCatalogService.populateTypeOptions(kind, catalog)
        if (prevKind && catalog.typesByKey[prevKind]) kind.value = prevKind

        const typeKey = kind.value || (catalog.types[0] && catalog.types[0].key)
        this.priceCatalogService.populateVariantOptions(variant, catalog, typeKey)

        if (prevVariant && catalog.itemsById[prevVariant]) {
          const prevItem = catalog.itemsById[prevVariant]
          if (prevItem && prevItem.typeKey === typeKey) variant.value = prevVariant
        }
      })
    })
  }

  appendRow() {
    if (!this.container) return
    this.container.appendChild(this.createTypeRow())
  }

  ensureRow() {
    if (!this.container) return
    if (this.container.children.length === 0) this.container.appendChild(this.createTypeRow())
  }

  setFirstVolume(volume) {
    const rounded = NumberUtils.roundTo(volume, 2)
    if (!Number.isFinite(rounded) || !(rounded > 0)) return

    this.ensureRow()

    const active = document.activeElement
    const isActiveVolume = active && active.classList && active.classList.contains('type-volume')
    const isInside = isActiveVolume && this.container && this.container.contains(active)

    const firstInput = this.container ? this.container.querySelector('.type-row .type-volume') : null
    const target = isInside ? active : firstInput
    if (!target) return

    target.value = rounded.toFixed(2)
    target.classList.remove('is-invalid')
  }

  resetVolumes() {
    document.querySelectorAll('.type-volume').forEach((input) => {
      input.value = '1.00'
      input.classList.remove('is-invalid')
    })
  }
}
