import { StorageService, ContentService, PriceCatalogService, OrderApiService } from './services.js'
import { LayoutController } from './controllers/LayoutController.js'
import { CompanyInfoController } from './controllers/CompanyInfoController.js'
import { PriceViewController } from './controllers/PriceViewController.js'
import { TypeRowsController } from './controllers/TypeRowsController.js'
import { CalculatorController } from './controllers/CalculatorController.js'
import { FoundationController } from './controllers/FoundationController.js'
import { ContactFormController } from './controllers/ContactFormController.js'
import { AdminController } from './controllers/AdminController.js'

export class MainPageApp {
  constructor() {
    this.contentService = new ContentService()

    const defaultStateFactory = () => ({
      prices: [
        { mark: 'M100', price: 2500 },
        { mark: 'M150', price: 2800 },
        { mark: 'M200', price: 3200 },
        { mark: 'M250', price: 3800 },
        { mark: 'M300', price: 4300 },
        { mark: 'M350', price: 4800 },
        { mark: 'M400', price: 5400 },
      ],
      mapSrc: document.getElementById('mapFrame') ? document.getElementById('mapFrame').src : '',
    })

    this.storageService = new StorageService('bz_data', defaultStateFactory)
    this.appData = this.storageService.load()

    this.priceCatalogService = new PriceCatalogService(this.contentService, () => this.appData)
    this.orderApiService = new OrderApiService()

    this.layoutController = new LayoutController()
    this.companyController = new CompanyInfoController()
    this.priceViewController = new PriceViewController(this.contentService)
    this.typeRowsController = new TypeRowsController(this.priceCatalogService)
    this.foundationController = new FoundationController(this.typeRowsController)
    this.calculatorController = new CalculatorController(this.typeRowsController, this.priceCatalogService, this.orderApiService)
    this.contactFormController = new ContactFormController(this.orderApiService)

    this.adminController = new AdminController(
      () => this.getAppDataMutable(),
      (next) => this.setAppData(next),
      () => this.persistAppData(),
      () => this.refreshPriceViews()
    )
  }

  getAppDataMutable() {
    return JSON.parse(JSON.stringify(this.appData))
  }

  setAppData(next) {
    this.appData = next
  }

  persistAppData() {
    this.storageService.save(this.appData)
  }

  async refreshPriceViews() {
    this.priceCatalogService.invalidate()
    await this.priceViewController.renderPriceTable(this.appData)
    this.typeRowsController.hydrateAllRows()
  }

  async init() {
    this.layoutController.init()
    this.typeRowsController.init()
    this.calculatorController.init()
    this.foundationController.init()
    this.contactFormController.init()
    this.adminController.init()

    await this.priceViewController.renderPriceTable(this.appData)
    this.typeRowsController.hydrateAllRows()

    const concreteInfo = await this.contentService.loadConcretePriceInfo()
    this.priceViewController.renderAboutSecondaryInfo(concreteInfo)
    this.priceViewController.renderMainExtraContacts(concreteInfo)
    this.priceViewController.renderHeaderTelegramContacts(concreteInfo)

    const company = await this.contentService.loadCompanyInfo()
    this.companyController.render(company)
  }
}
