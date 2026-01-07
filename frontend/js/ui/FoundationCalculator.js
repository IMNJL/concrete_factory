import { CalculationService } from '../services/CalculationService.js';

export class FoundationCalculator {
  constructor(container) {
    this.container = container;
    this.initUI();
  }

  initUI() {
    const form = document.createElement('form');
    form.innerHTML = `
      <label>Area (m²): <input type="number" id="area" required></label>
      <label>Thickness (m): <input type="number" id="thickness" required></label>
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
    const area = parseFloat(document.getElementById('area').value);
    const thickness = parseFloat(document.getElementById('thickness').value);

    try {
      const volume = CalculationService.calculateSlabFoundation(area, thickness);
      document.getElementById('result').textContent = `Volume: ${volume.toFixed(2)} m³`;
    } catch (error) {
      document.getElementById('result').textContent = error.message;
    }
  }
}