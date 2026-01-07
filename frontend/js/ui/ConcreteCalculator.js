import { CalculationService } from '../services/CalculationService.js';

export class ConcreteCalculator {
  constructor(container) {
    this.container = container;
    this.initUI();
  }

  initUI() {
    const form = document.createElement('form');
    form.innerHTML = `
      <label>Length (m): <input type="number" id="length" required></label>
      <label>Width (m): <input type="number" id="width" required></label>
      <label>Height (m): <input type="number" id="height" required></label>
      <button type="submit">Calculate</button>
      <div id="result"></div>
    `;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.calculate();
    });

    this.container.appendChild(form);
  }

  calculate() {
    const length = parseFloat(document.getElementById('length').value);
    const width = parseFloat(document.getElementById('width').value);
    const height = parseFloat(document.getElementById('height').value);

    try {
      const volume = CalculationService.calculateStripFoundation(length, width, height);
      document.getElementById('result').textContent = `Volume: ${volume.toFixed(2)} m³`;
    } catch (error) {
      document.getElementById('result').textContent = error.message;
    }
  }
}