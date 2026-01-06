// Main app script: handles types list, calculator, admin UI and order submission
document.addEventListener('DOMContentLoaded', ()=>{
  // --- Data model ---
  const DEFAULT_DATA = {
    prices: [
      {mark:'M100',price:2500},
      {mark:'M150',price:2800},
      {mark:'M200',price:3200},
      {mark:'M250',price:3800},
      {mark:'M300',price:4300},
      {mark:'M350',price:4800},
      {mark:'M400',price:5400},
    ],
    mapSrc: document.getElementById('mapFrame') ? document.getElementById('mapFrame').src : ''
  }

  function loadData(){
    try{ const raw = localStorage.getItem('bz_data'); if(!raw) return DEFAULT_DATA; return JSON.parse(raw) }
    catch(e){ console.error(e); return DEFAULT_DATA }
  }
  function saveData(data){ localStorage.setItem('bz_data', JSON.stringify(data)) }

  let appData = loadData()

  // --- Utils ---
  function formatPrice(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') }

  // render global price table and update any selects
  function renderPriceTable(){
    const el = document.getElementById('priceTable'); if(!el) return
    el.innerHTML = ''
    appData.prices.forEach(p=>{
      const row = document.createElement('div'); row.className='price-row'
      row.innerHTML = `<div><div class="price-mark">${p.mark}</div><div class="small">бетон</div></div><div class="price-amount">${formatPrice(p.price)} ₽</div>`
      el.appendChild(row)
    })
    // update options for all type selects
    document.querySelectorAll('.type-mark').forEach(sel=>populateMarkOptions(sel))
  }

  function populateMarkOptions(sel){
    if(!sel) return
    const cur = sel.value
    sel.innerHTML = ''
    appData.prices.forEach(p=>{
      const opt = document.createElement('option'); opt.value = p.mark; opt.textContent = `${p.mark} — ${formatPrice(p.price)} ₽/м³`; sel.appendChild(opt)
    })
    if(cur) sel.value = cur
  }

  // --- Types UI ---
  const typesContainer = document.getElementById('typesContainer')
  function createTypeRow(mark = '', volume = 1){
    const wrapper = document.createElement('div')
    wrapper.className = 'type-row'
    wrapper.style.display = 'flex'
    wrapper.style.gap = '8px'
    wrapper.style.marginBottom = '8px'

    const sel = document.createElement('select')
    sel.className = 'type-mark'
    sel.style.flex = '1'
    populateMarkOptions(sel)
    if(mark) sel.value = mark

    const vol = document.createElement('input')
    vol.type = 'number'
    vol.min = '0'
    vol.step = '0.1'
    vol.value = String(volume)
    vol.className = 'type-volume'
    vol.style.width = '110px'
    vol.style.padding = '10px'
    vol.style.borderRadius = '8px'
    vol.style.border = '1px solid #e5e7eb'

    const rm = document.createElement('button')
    rm.type = 'button'
    rm.textContent = '✕'
    rm.title = 'Удалить'
    rm.style.background = '#fff'
    rm.style.border = '1px solid #ddd'
    rm.style.borderRadius = '8px'
    rm.style.padding = '8px'
    rm.addEventListener('click', ()=>{ wrapper.remove() })

    wrapper.appendChild(sel)
    wrapper.appendChild(vol)
    wrapper.appendChild(rm)
    return wrapper
  }

  // ensure at least one row exists
  function ensureInitialType(){
    if(!typesContainer) return
    if(typesContainer.children.length === 0){ typesContainer.appendChild(createTypeRow()) }
  }

  // --- Calculator logic across all types ---
  function computeTotals(){
    const rows = Array.from(document.querySelectorAll('.type-row'))
    if(rows.length === 0) return { error: 'Добавьте хотя бы один тип бетона.' }
    let materialTotal = 0
    const details = []
    for(let i=0;i<rows.length;i++){
      const r = rows[i]
      const selectEl = r.querySelector('.type-mark')
      const volEl = r.querySelector('.type-volume')
      if(!selectEl) return { error: `Внутренняя ошибка: отсутствует селектор в строке ${i+1}` }
      const mark = String(selectEl.value || '').trim()
      const vol = parseFloat(volEl.value) || 0
      if(!mark) return { error: `Выберите марку в строке ${i+1}` }
      if(!(vol > 0)) return { error: `Введите объём (>0) в строке ${i+1}` }
      const priceObj = appData.prices.find(p=>p.mark === mark)
      if(!priceObj) return { error: `Невозможно найти цену для марки ${mark} (строка ${i+1})` }
      const price = priceObj.price
      const cost = Math.round(price * vol)
      materialTotal += cost
      details.push({mark, vol, price, cost})
    }
    const km = parseFloat(document.getElementById('deliveryKm').value) || 0
    const delivery = 1500 + (50 * km)
    const total = Math.round(materialTotal + delivery)
    return {details, materialTotal, delivery, total, km}
  }

  const calcBtn = document.getElementById('calcBtn')
  const clearBtn = document.getElementById('clearBtn')
  const addTypeBtn = document.getElementById('addTypeBtn')
  const submitOrderBtn = document.getElementById('submitOrder')
  const submitStatus = document.getElementById('submitStatus')

  if(calcBtn){
    calcBtn.addEventListener('click', ()=>{
      const res = computeTotals()
      if(res.error){ document.getElementById('calcResult').textContent = res.error; return }
      const {materialTotal, delivery, total} = res
      document.getElementById('calcResult').textContent = `Итог: ${formatPrice(total)} ₽ (материал ${formatPrice(materialTotal)} ₽ + доставка ${formatPrice(delivery)} ₽)`
    })
  }
  if(clearBtn){
    clearBtn.addEventListener('click', ()=>{
      // reset volumes to 1, delivery to 5
      document.querySelectorAll('.type-volume').forEach(inp=> inp.value = '1')
      document.getElementById('deliveryKm').value = '5'
      document.getElementById('calcResult').textContent = '—'
    })
  }

  if(addTypeBtn && typesContainer){
    addTypeBtn.addEventListener('click', ()=>{
      typesContainer.appendChild(createTypeRow())
      // scroll add button into view if needed
      addTypeBtn.scrollIntoView({behavior:'smooth', block:'center'})
    })
  }

  // submit order: build markdown table with rows
  if(submitOrderBtn){
    submitOrderBtn.addEventListener('click', async ()=>{
      const buyerName = (document.getElementById('buyerName')||{}).value || ''
      const buyerPhone = (document.getElementById('buyerPhone')||{}).value || ''
      const buyerEmail = (document.getElementById('buyerEmail')||{}).value || ''
      if(!buyerName || !buyerPhone){ alert('Пожалуйста, укажите имя и телефон покупателя.'); return }

  const res = computeTotals()
  if(res.error){ alert(res.error); return }
  const {details, materialTotal, delivery, total, km} = res

      // markdown table lines
      const lines = []
      lines.push('| № | Марка | Объём (м³) | Цена/м³ | Стоимость |')
      lines.push('|---:|---|---:|---:|---:')
      details.forEach((d,i)=>{
        lines.push(`| ${i+1} | ${d.mark} | ${d.vol} | ${formatPrice(d.price)} ₽ | ${formatPrice(d.cost)} ₽ |`)
      })
      lines.push('')
      lines.push(`**Материал:** ${formatPrice(materialTotal)} ₽`)
      lines.push(`**Доставка (${km} км):** ${formatPrice(delivery)} ₽`)
      lines.push(`**Итог:** ${formatPrice(total)} ₽`)
      lines.push('')
      lines.push(`**Покупатель:** ${buyerName}`)
      lines.push(`**Телефон:** ${buyerPhone}`)
      lines.push(`**Email:** ${buyerEmail || '-'} `)

      const md = lines.join('\n')

      submitStatus.textContent = 'Отправка...'
      try{
        const resp = await fetch('/api/order', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ markdown: md, order:{details, materialTotal, delivery, total, buyerName, buyerPhone, buyerEmail} })
        })
        if(!resp.ok) throw new Error(await resp.text())
        submitStatus.textContent = 'Отправлено — проверьте почту предприятия.'
      }catch(err){
        console.error(err)
        submitStatus.textContent = 'Ошибка отправки (см. консоль)'
        alert('Ошибка отправки заказа. Сервер может быть не запущен или неверные настройки SMTP.\n' + err.message)
      }
    })
  }

  // --- Admin modal actions (keep previous behavior) ---
  const adminBtn = document.getElementById('openAdmin')
  const adminModal = document.getElementById('adminModal')
  const closeAdmin = document.getElementById('closeAdmin')
  if(adminBtn && adminModal){ adminBtn.addEventListener('click',()=>{adminModal.style.display='block'}) }
  if(closeAdmin){ closeAdmin.addEventListener('click',()=>{adminModal.style.display='none'}) }

  const authBtn = document.getElementById('authBtn')
  if(authBtn){
    authBtn.addEventListener('click',()=>{
      const pass = document.getElementById('adminPass').value
      if(pass==='admin123'){
        document.getElementById('adminArea').style.display='block'
        document.getElementById('adminPass').value=''
        renderAdminTable()
        document.getElementById('mapSrc').value = appData.mapSrc
      }else{alert('Неверный пароль')}
    })
  }

  function renderAdminTable(){
    const tbody = document.querySelector('#adminTable tbody')
    if(!tbody) return
    tbody.innerHTML=''
    appData.prices.forEach((p,idx)=>{
      const tr = document.createElement('tr')
      tr.innerHTML = `<td>${p.mark}</td><td>${p.price}</td><td><button data-idx="${idx}" class="del">Удалить</button></td>`
      tbody.appendChild(tr)
    })
    tbody.querySelectorAll('.del').forEach(b=>b.addEventListener('click',e=>{
      const idx = +e.target.dataset.idx
      appData.prices.splice(idx,1)
      saveData(appData)
      renderAdminTable()
      renderPriceTable()
    }))
  }

  const addPriceBtn = document.getElementById('addPrice')
  if(addPriceBtn){
    addPriceBtn.addEventListener('click',()=>{
      const mark = document.getElementById('newMark').value.trim()
      const price = parseInt(document.getElementById('newPrice').value,10)
      if(!mark||!price){alert('Введите марку и цену') ; return}
      appData.prices.push({mark,price})
      saveData(appData)
      document.getElementById('newMark').value=''
      document.getElementById('newPrice').value=''
      renderAdminTable(); renderPriceTable()
    })
  }

  const exportBtn = document.getElementById('exportJson')
  if(exportBtn){
    exportBtn.addEventListener('click',()=>{
      const blob = new Blob([JSON.stringify(appData,null,2)],{type:'application/json'})
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='prices.json'; a.click(); URL.revokeObjectURL(url)
    })
  }

  const importFile = document.getElementById('importFile')
  if(importFile){
    importFile.addEventListener('change',async(e)=>{
      const f = e.target.files[0]
      if(!f) return
      try{
        const txt = await f.text()
        const parsed = JSON.parse(txt)
        if(parsed.prices){appData = parsed; saveData(appData); renderAdminTable(); renderPriceTable(); alert('Импорт выполнен')}
        else alert('Неверный формат')
      }catch(err){alert('Ошибка чтения файла')}
    })
  }

  const saveMapBtn = document.getElementById('saveMap')
  if(saveMapBtn){
    saveMapBtn.addEventListener('click',()=>{
      const v = document.getElementById('mapSrc').value.trim()
      if(!v){alert('Введите ссылку для iframe') ; return}
      appData.mapSrc = v
      const mapFrame = document.getElementById('mapFrame')
      if(mapFrame) mapFrame.src = v
      saveData(appData)
      alert('Сохранено')
    })
  }

  // --- Init ---
  renderPriceTable()
  ensureInitialType()
});
