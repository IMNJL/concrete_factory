import { Concrete } from '../domain/Concrete.js'
import { Foundation } from '../domain/Foundation.js'

export class CalculatorService {
  static calculateConcreteOrder(rows, prices, deliveryKm) {
    let materialTotal = 0
    const details = []

    rows.forEach(row => {
      const concrete = new Concrete(row.mark, prices[row.mark])
      const cost = concrete.cost(row.volume)
      materialTotal += cost
      details.push({ ...row, cost })
    })

    const delivery = 1500 + deliveryKm * 50
    return {
      details,
      materialTotal,
      delivery,
      total: materialTotal + delivery
    }
  }

  static calculateFoundationVolume(type, params) {
    let volume
    switch (type) {
      case 'strip': volume = Foundation.strip(params); break
      case 'slab': volume = Foundation.slab(params); break
      case 'pile': volume = Foundation.pile(params); break
      default: throw new Error('Неизвестный тип фундамента')
    }
    return Foundation.withReserve(volume)
  }
}
