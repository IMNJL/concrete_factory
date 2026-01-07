import { PriceTable } from './ui/PriceTable.js';

const apiUrl = 'http://localhost:3001';
const priceTableContainer = document.getElementById('price-table');

new PriceTable(priceTableContainer, apiUrl);