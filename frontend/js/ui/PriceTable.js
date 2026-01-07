import { OrderService } from '../services/OrderService.js';

export class PriceTable {
  constructor(container, apiUrl) {
    this.container = container;
    this.apiUrl = apiUrl;
    this.orderService = new OrderService(apiUrl);
    this.init();
  }

  async init() {
    try {
      const prices = await this.orderService.fetchPrices();
      this.renderTable(prices);
    } catch (error) {
      this.container.innerHTML = '<p>Error loading prices. Please try again later.</p>';
    }
  }

  renderTable(prices) {
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Mark</th>
          <th>Price per m³</th>
        </tr>
      </thead>
      <tbody>
        ${prices.map(price => `
          <tr>
            <td>${price.mark}</td>
            <td>${price.price} ₽</td>
          </tr>
        `).join('')}
      </tbody>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(table);
  }
}