export class OrderService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl;
  }

  static getApiBaseUrl() {
    try {
      const cfg = (window && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : null;
      const raw = cfg && typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl : '';
      return String(raw || '').trim().replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  static apiUrl(path) {
    const base = OrderService.getApiBaseUrl();
    const p = String(path || '');
    if (!base) return p;
    return base + (p.startsWith('/') ? p : `/${p}`);
  }

  async fetchPrices() {
    try {
      const response = await fetch(`${this.apiUrl}/api/prices`);
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching prices:', error);
      throw error;
    }
  }

  async addPrice(mark, price) {
    try {
      const response = await fetch(`${this.apiUrl}/api/prices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark, price }),
      });
      if (!response.ok) {
        throw new Error('Failed to add price');
      }
      return await response.json();
    } catch (error) {
      console.error('Error adding price:', error);
      throw error;
    }
  }

  static createOrder(details, buyerInfo) {
    if (!details || details.length === 0) {
      throw new Error('Order must include at least one item.');
    }
    if (!buyerInfo.name || !buyerInfo.phone) {
      throw new Error('Buyer information is incomplete.');
    }

    return {
      details,
      buyerName: buyerInfo.name,
      buyerPhone: buyerInfo.phone,
      buyerEmail: buyerInfo.email || '',
      materialTotal: details.reduce((sum, item) => sum + item.cost, 0),
      delivery: buyerInfo.delivery || 0,
      total: details.reduce((sum, item) => sum + item.cost, 0) + (buyerInfo.delivery || 0),
    };
  }

  static async submitOrder(order) {
    const response = await fetch(OrderService.apiUrl('/api/order'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      throw new Error('Failed to submit order.');
    }

    return await response.json();
  }
}
