export class Concrete {
  constructor(mark, pricePerM3) {
    this.mark = mark;
    this.pricePerM3 = pricePerM3;
  }

  cost(volume) {
    if (volume <= 0) throw new Error('Объём должен быть > 0');
    return this.pricePerM3 * volume;
  }
}