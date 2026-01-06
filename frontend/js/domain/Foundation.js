export class Foundation {
  static strip({ length, width, height }) {
    return length * width * height
  }

  static slab({ area, thickness }) {
    return area * thickness
  }

  static pile({ radius, depth, count }) {
    return Math.PI * radius ** 2 * depth * count
  }

  static withReserve(volume, k = 1.05) {
    return volume * k
  }
}

