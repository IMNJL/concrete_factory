import { Foundation } from '../models/Foundation.js';

export class CalculationService {
  static calculateStripFoundation(length, width, height, reserveFactor = 1.05) {
    const volume = Foundation.strip({ length, width, height });
    return Foundation.withReserve(volume, reserveFactor);
  }

  static calculateSlabFoundation(area, thickness, reserveFactor = 1.05) {
    const volume = Foundation.slab({ area, thickness });
    return Foundation.withReserve(volume, reserveFactor);
  }

  static calculatePileFoundation(radius, depth, count, reserveFactor = 1.05) {
    const volume = Foundation.pile({ radius, depth, count });
    return Foundation.withReserve(volume, reserveFactor);
  }
}