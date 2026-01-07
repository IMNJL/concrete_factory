import { OrderService } from '../services/OrderService.js';

export class AdminPanel {
  constructor(container) {
    this.container = container;
    this.initUI();
  }

  initUI() {
    const form = document.createElement('form');
    form.innerHTML = `
      <label>Mark: <input type="text" id="mark" required></label>
      <label>Price per m³: <input type="number" id="price" required></label>
      <button type="submit">Add</button>
      <div id="status"></div>
    `;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addPrice();
    });

    this.container.appendChild(form);
  }

  addPrice() {
    const mark = document.getElementById('mark').value;
    const price = parseFloat(document.getElementById('price').value);

    try {
      // Simulate adding price (backend integration can be added later)
      document.getElementById('status').textContent = `Added: ${mark} at ${price} ₽/m³`;
    } catch (error) {
      document.getElementById('status').textContent = error.message;
    }
  }
}