import { PriceTable } from './ui/PriceTable.js';

function getApiBaseUrl(){
  const cfg = (window && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : null
  const raw = cfg && typeof cfg.apiBaseUrl === 'string' ? cfg.apiBaseUrl : ''
  const trimmed = String(raw || '').trim()
  return trimmed.replace(/\/+$/,'')
}

const apiUrl = getApiBaseUrl();
const priceTableContainer = document.getElementById('price-table');

new PriceTable(priceTableContainer, apiUrl);

function updateCompanyInfo(data) {
  const companySection = document.getElementById('company-info');
  companySection.innerHTML = `
    <h2>${data.name}</h2>
    <p><strong>Адрес:</strong> ${data.address}</p>
    <p><strong>Телефон:</strong> ${data.phone}</p>
    <p><strong>ИНН:</strong> ${data.inn} | <strong>КПП:</strong> ${data.kpp} | <strong>ОГРН:</strong> ${data.ogrn}</p>
    <p><strong>Р/сч:</strong> ${data.bankAccount} | <strong>Банк:</strong> ${data.bankName} | <strong>БИК:</strong> ${data.bik} | <strong>К/сч:</strong> ${data.correspondentAccount}</p>
    <p>${data.description}</p>
  `;
}

function fetchCompanyInfo() {
  return fetch('assets/companyInfo.json')
    .then(response => response.json())
    .catch(error => {
      console.error('Error loading company info:', error);
      return null;
    });
}

console.log('Fetching company info...');
fetchCompanyInfo().then(data => {
  if (data) {
    console.log('Company info fetched:', data);
    updateCompanyInfo(data);

    // Top contact section
    const topContactSection = document.getElementById('top-contacts');
    console.log('Updating top-contacts section');
    topContactSection.innerHTML = `
      <h3>Контакты</h3>
      <div class="small">Телефон</div>
      <div style="font-weight:800;margin-bottom:8px">${data.phone}</div>
      <div class="small">Адрес</div>
      <div>${data.address}</div>
      <div style="margin-top:12px" class="small">Реквизиты</div>
      <div class="small">${data.name} ИНН ${data.inn}</div>
    `;

    // Bottom map section
    const bottomContactSection = document.getElementById('contacts');
    console.log('Updating contacts section');
    bottomContactSection.innerHTML = `
      <h2>Контакты и локация</h2>
      <div class="grid-3">
        <div>
          <h4>Адрес</h4>
          <div>${data.address}</div>
          <h4 style="margin-top:10px">Телефон</h4>
          <div>${data.phone}</div>
        </div>
        <div>
          <h4>Реквизиты</h4>
          <div class="small">${data.name}<br>ИНН ${data.inn}<br>р/c ${data.bankAccount}</div>
        </div>
        <div>
          <h4>Локация</h4>
          <iframe id="mapFrame" src="https://yandex.ru/map-widget/v1/?ll=61.400287%2C55.160505&z=14" style="width:100%;height:160px;border:0;border-radius:8px"></iframe>
        </div>
      </div>
    `;
  } else {
    console.error('Failed to fetch company info');
  }
});