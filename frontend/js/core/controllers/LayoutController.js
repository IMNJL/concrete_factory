export class LayoutController {
  constructor() {
    this.menuBtn = document.getElementById('menuBtn')
    this.overlay = document.getElementById('mobileMenuOverlay')
    this.closeBtn = document.getElementById('menuCloseBtn')
    this.links = document.getElementById('mobileMenuLinks')
  }

  init() {
    this.syncHeaderOffset()
    window.addEventListener('load', () => this.syncHeaderOffset(), { passive: true })
    window.addEventListener('resize', () => this.syncHeaderOffset(), { passive: true })
    window.addEventListener('orientationchange', () => this.syncHeaderOffset(), { passive: true })
    this.initMobileMenu()
  }

  syncHeaderOffset() {
    const header = document.querySelector('header.site-header')
    if (!header) return
    const px = Math.max(0, Math.round(header.offsetHeight + 10))
    document.documentElement.style.setProperty('--header-offset', `${px}px`)
  }

  initMobileMenu() {
    if (!this.menuBtn || !this.overlay) return

    const close = () => {
      this.overlay.classList.remove('is-open')
      this.menuBtn.setAttribute('aria-expanded', 'false')
      document.body.classList.remove('is-menu-open')
      window.setTimeout(() => {
        this.overlay.hidden = true
        this.syncHeaderOffset()
      }, 200)
    }

    const open = () => {
      this.overlay.hidden = false
      requestAnimationFrame(() => this.overlay.classList.add('is-open'))
      this.menuBtn.setAttribute('aria-expanded', 'true')
      document.body.classList.add('is-menu-open')
      this.syncHeaderOffset()
    }

    this.menuBtn.addEventListener('click', () => {
      const isExpanded = this.menuBtn.getAttribute('aria-expanded') === 'true'
      if (isExpanded) close()
      else open()
    })

    if (this.closeBtn) this.closeBtn.addEventListener('click', close)

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) close()
    })

    if (this.links) {
      this.links.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('a') : null
        if (link) close()
      })
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.hidden) close()
    })
  }
}
