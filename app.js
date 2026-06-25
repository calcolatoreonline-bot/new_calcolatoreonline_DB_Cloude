/* ══════════════════════════════════════════════════════════════════════════════
   DASHBOARD NUTRIZIONE ELITE - app.js v7.0 MODERNO
   - 5 Grafici a Linee Moderni
   - 3ª Pagina PDF con Grafici
   - Stats Summary Sotto Grafici
   - Colori 2024-2025 Indigo/Violet/Emerald
══════════════════════════════════════════════════════════════════════════════ */

const targetUrl = 'https://ympbqcmbhnjerjqxgska.supabase.co';
const targetKey = 'sb_publishable_8bs12qrDkQmPi4pOQTMQyg_ef9r5-KW';

let sbClient = null;

try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    sbClient = window.supabase.createClient(targetUrl, targetKey);
    console.log('✅ Supabase connesso con successo.');
  }
} catch (err) {
  console.error('❌ Errore Database Supabase:', err);
}

const FILES = {
  logo:   'logo_de_salvo_transparent.png',
  silM:   'Siluette_Uomo.jpeg',
  silF:   'Siluette_Donna.jpeg',
  eliteM: 'COMPOSIZIONE CORPOREA UOMO.JPEG',
  eliteF: 'COMPOSIZIONE CORPOREA DONNA.JPEG',
};

let currentPatient = null;
let currentVisitId = null;
let cachedVisitsList = [];
let allPatientsCache = [];

// Istanze grafici moderni
let chartPeso = null, chartBmi = null, chartComp = null, chartCircTronco = null, chartPliche = null;

// Palette 2024-2025
const COLORS = {
  indigo: '#4f46e5',
  violet: '#a855f7',
  emerald: '#10b981',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  amber: '#f59e0b',
  orange: '#ea580c',
  slate: '#475569',
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  window.addEventListener('resize', gestisciAnteprimaMobile);
});

function initEventListeners() {
  document.getElementById('btn-open-modal')?.addEventListener('click', () => document.getElementById('modal-paziente')?.classList.remove('hidden'));
  document.getElementById('btn-close-modal')?.addEventListener('click', chiudiModale);
  document.getElementById('btn-close-modal-cancel')?.addEventListener('click', chiudiModale);
  document.getElementById('modal-overlay')?.addEventListener('click', chiudiModale);
  document.getElementById('btn-registra-paziente')?.addEventListener('click', registraPaziente);
  
  document.getElementById('patient-search')?.addEventListener('click', apriRubricaBanner);
  document.getElementById('btn-close-rubrica')?.addEventListener('click', chiudiRubricaBanner);
  document.getElementById('rubrica-search-input')?.addEventListener('input', filtraPazientiInRubrica);

  document.getElementById('btn-salva-visita')?.addEventListener('click', salvaVisita);
  document.getElementById('btn-calcola-report')?.addEventListener('click', elaboraA4EVisualizzaTutto);
  document.getElementById('btn-pdf')?.addEventListener('click', scaricaPDF);
  
  document.getElementById('select-visita-storica')?.addEventListener('change', (e) => {
    if (e.target.value === 'new') {
      document.getElementById('form-valutazione').reset();
      document.getElementById('in-laf').value = '1.375';
      currentVisitId = null;
      autoCompilaEtaIniziale();
    } else {
      currentVisitId = e.target.value;
      caricaDatiVisitaSingola(currentVisitId);
    }
  });
}

function chiudiModale() {
  document.getElementById('modal-paziente')?.classList.add('hidden');
  document.getElementById('new-nominativo').value = '';
  document.getElementById('new-sesso').value = '';
  document.getElementById('new-nascita').value = '';
}

async function apriRubricaBanner() {
  document.getElementById('banner-rubrica').classList.remove('hidden');
  document.getElementById('rubrica-search-input').value = '';
  document.getElementById('rubrica-search-input').focus();
  if (!sbClient) return;
  try {
    const { data, error } = await sbClient.from('pazienti').select('*').order('nominativo', { ascending: true });
    if (error) throw error;
    allPatientsCache = data;
    renderListaPazientiRubrica(allPatientsCache);
  } catch (err) { console.error(err); }
}

function chiudiRubricaBanner() {
  document.getElementById('banner-rubrica').classList.add('hidden');
}

function renderListaPazientiRubrica(lista) {
  const container = document.getElementById('rubrica-patients-container');
  if (lista.length === 0) {
    container.innerHTML = `<div class="rubrica-empty">Nessun paziente trovato corrispondente ai criteri di ricerca.</div>`;
    return;
  }
  container.innerHTML = lista.map(p => {
    const dataNascitaF = p.data_nascita ? new Date(p.data_nascita).toLocaleDateString('it-IT') : 'Non inserita';
    return `
      <div class="rubrica-patient-card" data-id="${p.id}" data-name="${p.nominativo}" data-gender="${p.sesso}" data-birth="${p.data_nascita || ''}">
        <div class="rpc-avatar ${p.sesso.toLowerCase()}">${p.sesso}</div>
        <div class="rpc-details">
          <h4>${p.nominativo}</h4>
          <p>Nato/a il: <strong>${dataNascitaF}</strong></p>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.rubrica-patient-card').forEach(card => {
    card.addEventListener('click', function() {
      selezionaPaziente(
        this.getAttribute('data-id'),
        this.getAttribute('data-name'),
        this.getAttribute('data-gender'),
        this.getAttribute('data-birth')
      );
      chiudiRubricaBanner();
    });
  });
}

function filtraPazientiInRubrica(e) {
  const query = e.target.value.toUpperCase().trim();
  if (!query) { renderListaPazientiRubrica(allPatientsCache); return; }
  renderListaPazientiRubrica(allPatientsCache.filter(p => p.nominativo.toUpperCase().includes(query)));
}

function gestisciAnteprimaMobile() {
  if (window.innerWidth > 820) {
    document.querySelectorAll('.pg-wrap').forEach(el => el.style.transform = 'none');
    document.querySelectorAll('.pg-container-mobile').forEach(el => el.style.height = 'auto');
    return;
  }
  const larghezzaSchermo = window.innerWidth - 20;
  const fattoreScala = larghezzaSchermo / 794;
  const altezzaScalata = 1123 * fattoreScala;
  document.querySelectorAll('.pg-wrap').forEach(el => el.style.transform = `scale(${fattoreScala})`);
  document.querySelectorAll('.pg-container-mobile').forEach(el => el.style.height = `${altezzaScalata}px`);
}

async function registraPaziente() {
  const nom = document.getElementById('new-nominativo').value.toUpperCase().trim();
  const sesso = document.getElementById('new-sesso').value;
  const nascita = document.getElementById('new-nascita').value || null;
  if (!nom || !sesso) { alert('⚠️ Campi obbligatori mancanti.'); return; }
  if (!sbClient) return;
  try {
    const { data, error } = await sbClient.from('pazienti').insert([{ nominativo: nom, sesso, data_nascita: nascita }]).select();
    if (error) throw error;
    chiudiModale();
    selezionaPaziente(data[0].id, data[0].nominativo, data[0].sesso, data[0].data_nascita);
  } catch (err) { alert(err.message); }
}

async function selezionaPaziente(id, nominativo, sesso, data_nascita) {
  currentPatient = { id, nominativo, sesso, data_nascita };
  document.getElementById('current-patient-name').textContent = nominativo;
  
  const badge = document.getElementById('patient-gender-badge');
  badge.textContent = sesso === 'M' ? '👨 Uomo' : '👩 Donna';
  badge.className = `gender-badge ${sesso === 'M' ? 'm' : 'f'}`;
  
  document.getElementById('in-nominativo').value = nominativo;
  document.getElementById('in-sesso').value = sesso;

  document.getElementById('preview-area').classList.add('hidden');
  document.getElementById('charts-section').classList.add('hidden');

  aggiornaFormUI(sesso);
  await caricaStoricoVisite(id);
  
  document.getElementById('select-visita-storica').value = 'new';
  document.getElementById('form-valutazione').reset();
  document.getElementById('in-laf').value = '1.375';
  currentVisitId = null;
  autoCompilaEtaIniziale();
}

function autoCompilaEtaIniziale() {
  if (!currentPatient) return;
  if (currentPatient.data_nascita) {
    const dataNascita = new Date(currentPatient.data_nascita);
    document.getElementById('in-eta').value = 2026 - dataNascita.getFullYear();
    return;
  }
  if (cachedVisitsList && cachedVisitsList.length > 0) {
    const ultimaVisitaConEta = [...cachedVisitsList].reverse().find(v => v.eta && v.eta > 0);
    if (ultimaVisitaConEta) document.getElementById('in-eta').value = ultimaVisitaConEta.eta;
  }
}

function aggiornaFormUI(sesso) {
  const contAntro = document.getElementById('cont-antro');
  const contPliche = document.getElementById('cont-pliche');
  if (sesso === 'M') {
    contAntro.innerHTML = `
      <div class="form-group"><label>Collo (cm)</label><input type="number" id="c-collo" step="0.1" placeholder="38"></div>
      <div class="form-group"><label>Torace (cm)</label><input type="number" id="c-torace" step="0.1" placeholder="102"></div>
      <div class="form-group"><label>Vita (cm)</label><input type="number" id="c-vita" step="0.1" placeholder="88"></div>
      <div class="form-group"><label>Fianchi (cm)</label><input type="number" id="c-fianchi" step="0.1" placeholder="96"></div>
      <div class="form-group"><label>Braccio Ril. (cm)</label><input type="number" id="c-braccio-ril" step="0.1" placeholder="32"></div>
      <div class="form-group"><label>Braccio Con. (cm)</label><input type="number" id="c-braccio-con" step="0.1" placeholder="35"></div>
      <div class="form-group"><label>Coscia (cm)</label><input type="number" id="c-coscia" step="0.1" placeholder="58"></div>
    `;
    const pM = ['Pettorale', 'Ascellare', 'Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'];
    contPliche.innerHTML = pM.map(p => `
      <div class="form-group"><label>${p} (mm)</label><input type="number" id="p-${p.toLowerCase()}" step="0.1" placeholder="10"></div>
    `).join('');
  } else {
    contAntro.innerHTML = `
      <div class="form-group"><label>Collo (cm)</label><input type="number" id="c-collo" step="0.1" placeholder="34"></div>
      <div class="form-group"><label>Vita (cm)</label><input type="number" id="c-vita" step="0.1" placeholder="68"></div>
      <div class="form-group"><label>Fianchi (cm)</label><input type="number" id="c-fianchi" step="0.1" placeholder="92"></div>
      <div class="form-group"><label>Gluteo (cm)</label><input type="number" id="c-gluteo" step="0.1" placeholder="96"></div>
      <div class="form-group"><label>Braccio Ril. (cm)</label><input type="number" id="c-braccio-ril" step="0.1" placeholder="27"></div>
      <div class="form-group"><label>Braccio Con. (cm)</label><input type="number" id="c-braccio-con" step="0.1" placeholder="29"></div>
      <div class="form-group"><label>Coscia (cm)</label><input type="number" id="c-coscia" step="0.1" placeholder="54"></div>
    `;
    const pF = ['Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'];
    contPliche.innerHTML = pF.map(p => `
      <div class="form-group"><label>${p} (mm)</label><input type="number" id="p-${p.toLowerCase()}" step="0.1" placeholder="12"></div>
    `).join('');
  }
}

async function caricaStoricoVisite(pazienteId) {
  if (!sbClient) return;
  try {
    const { data, error } = await sbClient.from('visite').select('*').eq('paziente_id', pazienteId).order('data_visita', { ascending: true });
    if (error) throw error;
    cachedVisitsList = data;
    const select = document.getElementById('select-visita-storica');
    select.innerHTML = '<option value="new">➕ Nuova Visita (Oggi)</option>';
    data.forEach(v => {
      const dataF = new Date(v.data_visita).toLocaleDateString('it-IT');
      select.innerHTML += `<option value="${v.id}">Visita del ${dataF} (${v.peso} kg)</option>`;
    });
    renderingGraficiElite(data);
  } catch (err) { console.error(err); }
}

/* 📊 LOGICA COSTRUZIONE 5 GRAFICI MODERNI CON COLORI 2024-2025 */
function renderingGraficiElite(visite) {
  if (!visite || visite.length === 0) return;
  const labels = visite.map(v => new Date(v.data_visita).toLocaleDateString('it-IT'));
  
  const configComune = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: {
          boxWidth: 12,
          font: { size: 12, weight: '600' },
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    },
    scales: {
      x: { grid: { display: false, drawBorder: false } },
      y: { grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false } }
    },
    elements: {
      line: { tension: 0.4, borderWidth: 2.5 },
      point: { radius: 4, hoverRadius: 7, backgroundColor: '#ffffff', borderWidth: 2 }
    }
  };

  // 1. PESO
  if (chartPeso) chartPeso.destroy();
  const pesoData = visite.map(v => v.peso);
  chartPeso = new Chart(document.getElementById('chart-peso').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Peso (kg)',
        data: pesoData,
        borderColor: COLORS.indigo,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        pointBorderColor: COLORS.indigo,
      }]
    },
    options: configComune
  });
  renderStatsWidget('stats-peso', pesoData, 'kg');

  // 2. BMI
  if (chartBmi) chartBmi.destroy();
  const bmiData = visite.map(v => (v.peso && v.altezza) ? (v.peso / Math.pow(v.altezza/100, 2)).toFixed(1) : null);
  chartBmi = new Chart(document.getElementById('chart-bmi').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'BMI',
        data: bmiData,
        borderColor: COLORS.violet,
        backgroundColor: 'rgba(168, 85, 247, 0.08)',
        fill: true,
        pointBorderColor: COLORS.violet,
      }]
    },
    options: configComune
  });
  renderStatsWidget('stats-bmi', bmiData, 'BMI');

  // 3. COMPOSIZIONE (Massa Grassa e Magra)
  const fmData = [];
  const ffmData = [];
  visite.forEach(v => {
    const s = currentPatient.sesso;
    const eta = v.eta || 30;
    let somma = s === 'M'
      ? (v.p_pettorale||0)+(v.p_ascellare||0)+(v.p_addome||0)+(v.p_soprailiaca||0)+(v.p_tricipitale||0)+(v.p_sottoscapolare||0)+(v.p_coscia||0)
      : (v.p_addome||0)+(v.p_soprailiaca||0)+(v.p_tricipitale||0)+(v.p_sottoscapolare||0)+(v.p_coscia||0);
    if (somma > 0) {
      let bd = s === 'M'
        ? 1.112 - (0.00043499 * somma) + (0.00000055 * somma * somma) - (0.00028826 * eta)
        : 1.0994921 - (0.0009929 * somma) + (0.0000023 * somma * somma) - (0.0001392 * eta);
      let fm = (495 / bd) - 450;
      fmData.push(Math.round(fm * 10) / 10);
      ffmData.push(Math.round((100 - fm) * 10) / 10);
    } else {
      fmData.push(null);
      ffmData.push(null);
    }
  });

  if (chartComp) chartComp.destroy();
  chartComp = new Chart(document.getElementById('chart-composizione').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Massa Grassa %',
          data: fmData,
          borderColor: COLORS.rose,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointBorderColor: COLORS.rose,
        },
        {
          label: 'Massa Magra %',
          data: ffmData,
          borderColor: COLORS.emerald,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          pointBorderColor: COLORS.emerald,
        }
      ]
    },
    options: configComune
  });
  renderStatsWidget('stats-composizione', fmData, '%');

  // 4. CIRCONFERENZE PRINCIPALI (Vita, Fianchi, Collo)
  if (chartCircTronco) chartCircTronco.destroy();
  chartCircTronco = new Chart(document.getElementById('chart-circonferenze-tronco').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Vita (cm)',
          data: visite.map(v => v.c_vita),
          borderColor: COLORS.indigo,
          pointBorderColor: COLORS.indigo,
          fill: false,
          borderWidth: 2.5,
        },
        {
          label: 'Fianchi (cm)',
          data: visite.map(v => v.c_fianchi),
          borderColor: COLORS.violet,
          pointBorderColor: COLORS.violet,
          fill: false,
          borderWidth: 2.5,
        },
        {
          label: 'Collo (cm)',
          data: visite.map(v => v.c_collo),
          borderColor: COLORS.slate,
          pointBorderColor: COLORS.slate,
          fill: false,
          borderWidth: 2.5,
        }
      ]
    },
    options: configComune
  });
  renderStatsWidget('stats-circ-tronco', visite.map(v => v.c_vita), 'cm');

  // 5. TREND PLICHE PRINCIPALI
  if (chartPliche) chartPliche.destroy();
  chartPliche = new Chart(document.getElementById('chart-pliche-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Addome (mm)',
          data: visite.map(v => v.p_addome),
          borderColor: COLORS.orange,
          pointBorderColor: COLORS.orange,
          fill: false,
          borderWidth: 2.5,
        },
        {
          label: 'Tricipitale (mm)',
          data: visite.map(v => v.p_tricipitale),
          borderColor: COLORS.emerald,
          pointBorderColor: COLORS.emerald,
          fill: false,
          borderWidth: 2.5,
        },
        {
          label: 'Coscia (mm)',
          data: visite.map(v => v.p_coscia),
          borderColor: COLORS.sky,
          pointBorderColor: COLORS.sky,
          fill: false,
          borderWidth: 2.5,
        }
      ]
    },
    options: configComune
  });
  renderStatsWidget('stats-pliche', visite.map(v => v.p_addome), 'mm');
}

/* Renderizza il riepilogo statistico sotto ogni grafico */
function renderStatsWidget(containerId, dataArray, unit) {
  const container = document.getElementById(containerId);
  if (!container || !dataArray || dataArray.length === 0) return;

  const filteredData = dataArray.filter(v => v !== null && v !== undefined);
  if (filteredData.length === 0) return;

  const min = Math.min(...filteredData);
  const max = Math.max(...filteredData);
  const avg = (filteredData.reduce((a, b) => a + b, 0) / filteredData.length).toFixed(1);
  const last = filteredData[filteredData.length - 1];
  const first = filteredData[0];
  const change = (last - first).toFixed(1);
  const changePercent = ((change / first) * 100).toFixed(1);

  container.innerHTML = `
    <div class="stat-item">
      <div class="stat-label">Min</div>
      <div class="stat-value">${min.toFixed(1)} ${unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Max</div>
      <div class="stat-value">${max.toFixed(1)} ${unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Media</div>
      <div class="stat-value">${avg} ${unit}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">Variazione</div>
      <div class="stat-value">${change > 0 ? '+' : ''}${change} ${unit}</div>
    </div>
  `;
}

const n = id => parseFloat(document.getElementById(id)?.value) || 0;

async function salvaVisita() {
  if (!currentPatient) { alert('⚠️ Seleziona un paziente attivo.'); return; }
  const payload = {
    paziente_id: currentPatient.id,
    eta: n('in-eta'),
    peso: n('in-peso'),
    altezza: n('in-altezza'),
    laf: n('in-laf'),
    c_collo: n('c-collo'),
    c_torace: document.getElementById('c-torace') ? n('c-torace') : null,
    c_vita: n('c-vita'),
    c_fianchi: n('c-fianchi'),
    c_gluteo: document.getElementById('c-gluteo') ? n('c-gluteo') : null,
    c_braccio: n('c-braccio-ril'),
    c_braccio_contratto: n('c-braccio-con'),
    c_coscia: n('c-coscia'),
    p_pettorale: document.getElementById('p-pettorale') ? n('p-pettorale') : null,
    p_ascellare: document.getElementById('p-ascellare') ? n('p-ascellare') : null,
    p_addome: n('p-addome'),
    p_soprailiaca: n('p-soprailiaca'),
    p_tricipitale: n('p-tricipitale'),
    p_sottoscapolare: n('p-sottoscapolare'),
    p_coscia: n('p-coscia'),
    data_visita: new Date().toISOString().split('T')[0]
  };

  if (!sbClient) return;
  try {
    let res = currentVisitId
      ? await sbClient.from('visite').update(payload).eq('id', currentVisitId).select()
      : await sbClient.from('visite').insert([payload]).select();
    if (res.error) throw res.error;
    
    alert('✅ Visita salvata con successo.');
    
    document.getElementById('preview-area').classList.add('hidden');
    document.getElementById('charts-section').classList.remove('hidden');
    
    await caricaStoricoVisite(currentPatient.id);
  } catch (err) { alert(err.message); }
}

async function caricaDatiVisitaSingola(id) {
  if (!sbClient) return;
  try {
    const { data, error } = await sbClient.from('visite').select('*').eq('id', id).single();
    if (error) throw error;
    document.getElementById('in-eta').value = data.eta || '';
    document.getElementById('in-peso').value = data.peso || '';
    document.getElementById('in-altezza').value = data.altezza || '';
    document.getElementById('in-laf').value = data.laf || '1.375';

    if (document.getElementById('c-collo')) document.getElementById('c-collo').value = data.c_collo || '';
    if (document.getElementById('c-torace')) document.getElementById('c-torace').value = data.c_torace || '';
    if (document.getElementById('c-vita')) document.getElementById('c-vita').value = data.c_vita || '';
    if (document.getElementById('c-fianchi')) document.getElementById('c-fianchi').value = data.c_fianchi || '';
    if (document.getElementById('c-gluteo')) document.getElementById('c-gluteo').value = data.c_gluteo || '';
    if (document.getElementById('c-braccio-ril')) document.getElementById('c-braccio-ril').value = data.c_braccio || '';
    if (document.getElementById('c-braccio-con')) document.getElementById('c-braccio-con').value = data.c_braccio_contratto || '';
    if (document.getElementById('c-coscia')) document.getElementById('c-coscia').value = data.c_coscia || '';

    const pliche = ['pettorale', 'ascellare', 'addome', 'soprailiaca', 'tricipitale', 'sottoscapolare', 'coscia'];
    pliche.forEach(p => {
      const el = document.getElementById(`p-${p}`);
      if (el) el.value = data[`p_${p}`] || '';
    });
  } catch (err) { console.error(err); }
}

function set(id, val) { const el = document.getElementById(id); if (el) el.innerHTML = val; }
function src(id, url) { const el = document.getElementById(id); if (el) el.src = url; }

/* 📊 ELABORA A4 E VISUALIZZA GRAFICI */
function elaboraA4EVisualizzaTutto() {
  if (!currentPatient) { alert('⚠️ Seleziona un paziente attivo.'); return; }
  
  document.getElementById('preview-area').classList.remove('hidden');
  document.getElementById('charts-section').classList.remove('hidden');

  const sesso = currentPatient.sesso;
  const peso = n('in-peso');
  const altezza = n('in-altezza');
  const eta = n('in-eta');
  const laf = parseFloat(document.getElementById('in-laf').value);
  const nom = currentPatient.nominativo.toUpperCase();
  
  const atletaTextHtml = `ATLETA: <span class="atleta-name-wrap">${nom}</span>`;
  const oggi = new Date();
  const dataStringa = [oggi.getDate(), oggi.getMonth() + 1, oggi.getFullYear()].map(x => String(x).padStart(2, '0')).join('-');

  const silPath = sesso === 'M' ? FILES.silM : FILES.silF;
  const elitePath = sesso === 'M' ? FILES.eliteM : FILES.eliteF;
  ['r-sil-l', 'r-sil-r'].forEach(id => src(id, silPath));
  ['r-esil-l', 'r-esil-r'].forEach(id => src(id, elitePath));
  ['r-logo1', 'r-logo2', 'r-wm1', 'r-wm2'].forEach(id => src(id, FILES.logo));

  set('r-nome1', atletaTextHtml);
  set('r-data1', dataStringa);
  set('r-nome2', atletaTextHtml);
  set('r-data2', dataStringa);

  let bmrV = '-', rmrV = '-', tdeeV = '-', tdeewV = '-';
  if (peso > 0 && altezza > 0 && eta > 0) {
    let bmr = sesso === 'M' ? (10 * peso + 6.25 * altezza - 5 * eta + 5) : (10 * peso + 6.25 * altezza - 5 * eta - 161);
    let rmr = sesso === 'M' ? (66.473 + 13.7516 * peso + 5.0033 * altezza - 6.755 * eta) : (655.0955 + 9.5634 * peso + 1.8496 * altezza - 4.6756 * eta);
    bmrV = Math.round(bmr) + " kcal";
    rmrV = Math.round(rmr) + " kcal";
    tdeeV = Math.round(bmr * laf) + " kcal";
    tdeewV = Math.round(bmr * laf * 7) + " kcal/sett";
  }
  set('r-bmr', bmrV);
  set('r-rmr', rmrV);
  set('r-tdee', tdeeV);
  set('r-tdeew', tdeewV);

  const pk = sesso === 'M' ? ['Pettorale', 'Ascellare', 'Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'] : ['Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'];
  let sommaPliche = 0;
  let haPliche = false;
  pk.forEach(p => {
    let v = parseFloat(document.getElementById('p-' + p.toLowerCase())?.value) || 0;
    sommaPliche += v;
    if (v > 0) haPliche = true;
  });

  let gccV = '-', fmV = '-', ffmV = '-', ibwV = '-', kggV = '-', kgmV = '-';
  if (haPliche && peso > 0 && eta > 0) {
    let densita = sesso === 'M'
      ? 1.112 - (0.00043499 * sommaPliche) + (0.00000055 * sommaPliche * sommaPliche) - (0.00028826 * eta)
      : 1.0994921 - (0.0009929 * sommaPliche) + (0.0000023 * sommaPliche * sommaPliche) - (0.0001392 * eta);
    let fm = (495 / densita) - 450;
    let ffm = 100 - fm;
    let kgg = (peso * fm) / 100;
    let kgm = peso - kgg;
    let iMin = sesso === 'M' ? kgm / 0.90 : kgm / 0.82;
    let iMax = sesso === 'M' ? kgm / 0.88 : kgm / 0.78;

    gccV = densita.toFixed(4).replace('.', ',') + " g/cc";
    fmV = fm.toFixed(2).replace('.', ',') + " %";
    ffmV = ffm.toFixed(2).replace('.', ',') + " %";
    ibwV = Math.round(iMin) + " - " + Math.round(iMax) + " kg";
    kggV = kgg.toFixed(2).replace('.', ',') + " kg";
    kgmV = kgm.toFixed(2).replace('.', ',') + " kg";
  }

  set('r-lbl-pliche', `Plicometria totale (${sesso === 'M' ? 7 : 5} pliche):`);
  set('r-pliche', haPliche ? sommaPliche.toFixed(1).replace('.', ',') + " mm" : "-");
  set('r-gcc', gccV);
  set('r-fm', fmV);
  set('r-ffm', ffmV);
  set('r-ibw', ibwV);
  set('r-kgg', kggV);
  set('r-kgm', kgmV);
  set('r-peso', peso > 0 ? peso.toFixed(2).replace('.', ',') + " kg" : "-");

  const formatVal = id => { const el = document.getElementById(id); return el && el.value ? el.value.toString().replace('.', ',') : '-'; };
  let rows = `<tr><td>Peso</td><td><strong>${formatVal('in-peso')} kg</strong></td></tr>
              <tr><td>Altezza</td><td><strong>${formatVal('in-altezza')} cm</strong></td></tr>
              <tr><td>Circonferenza collo</td><td><strong>${formatVal('c-collo')} cm</strong></td></tr>`;
  if (sesso === 'M') rows += `<tr><td>Circonferenza toracica</td><td><strong>${formatVal('c-torace')} cm</strong></td></tr>`;
  rows += `<tr><td>Circonferenza vita</td><td><strong>${formatVal('c-vita')} cm</strong></td></tr>
           <tr><td>Circonferenza fianchi</td><td><strong>${formatVal('c-fianchi')} cm</strong></td></tr>`;
  if (sesso === 'F') rows += `<tr><td>Circonferenza gluteo</td><td><strong>${formatVal('c-gluteo')} cm</strong></td></tr>`;
  rows += `<tr><td>Circonferenza braccio rilassato</td><td><strong>${formatVal('c-braccio-ril')} cm</strong></td></tr>
           <tr><td>Circonferenza braccio contratto</td><td><strong>${formatVal('c-braccio-con')} cm</strong></td></tr>
           <tr><td>Circonferenza coscia</td><td><strong>${formatVal('c-coscia')} cm</strong></td></tr>`;

  pk.forEach(p => { rows += `<tr><td>Plica ${p.toLowerCase()}</td><td><strong>${formatVal('p-' + p.toLowerCase())} mm</strong></td></tr>`; });
  document.getElementById('r-antro-rows').innerHTML = rows;

  document.getElementById('r-footer').innerHTML = `
    <p>Plicometro: GIMA DIGITALE (modello 37320)</p>
    <p>Metodo: ${sesso === 'M' ? 'Jackson & Pollock / 7 pliche' : 'Jackson & Pollock / 5 pliche'}</p>
    <p>Somma pliche (mm) = ${sommaPliche.toFixed(2).replace('.', ',')} mm</p>
  `;

  gestisciAnteprimaMobile();
  document.getElementById('preview-area').scrollIntoView({ behavior: 'smooth' });
}

/* 📥 DOWNLOAD PDF - ORA CON 3ª PAGINA CON GRAFICI */
async function scaricaPDF() {
  const btn = document.getElementById('btn-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Generazione PDF con grafici...';
  
  const wraps = document.querySelectorAll('.pg-wrap');
  const watermarks = document.querySelectorAll('.wmark');
  const vecchieTrasformazioni = [];
  const isMobile = window.innerWidth <= 820;

  wraps.forEach(el => { vecchieTrasformazioni.push(el.style.transform); el.style.transform = 'none'; });
  if (isMobile) watermarks.forEach(wm => wm.style.setProperty('width', '502px', 'important'));

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    
    // 1. Prima pagina (A4 con Fabbisogni Energetici)
    const canvas1 = await html2canvas(document.getElementById('pdf-p1'), {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
      width: 794, height: 1123, windowWidth: 794, windowHeight: 1123
    });
    const img1 = canvas1.toDataURL('image/jpeg', 0.97);
    pdf.addImage(img1, 'JPEG', 0, 0, 210, 297);

    // 2. Seconda pagina (A4 con Composizione Corporea)
    const canvas2 = await html2canvas(document.getElementById('pdf-p2'), {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
      width: 794, height: 1123, windowWidth: 794, windowHeight: 1123
    });
    const img2 = canvas2.toDataURL('image/jpeg', 0.97);
    pdf.addPage();
    pdf.addImage(img2, 'JPEG', 0, 0, 210, 297);

    // 3. Terza pagina: GRAFICI MODERNI
    pdf.addPage();
    await generaChartsPage(pdf);

    pdf.save(`${currentPatient?.nominativo || 'PAZIENTE'} - Composizione corporea e Fabbisogni energetici.pdf`);
  } catch (e) {
    console.error(e);
    alert('❌ Errore durante la generazione del PDF.');
  }

  if (isMobile) watermarks.forEach(wm => wm.style.removeProperty('width'));
  wraps.forEach((el, index) => el.style.transform = vecchieTrasformazioni[index]);
  btn.disabled = false;
  btn.textContent = '📥 Scarica PDF Report (Con Grafici)';
}

/* Genera la 3ª pagina PDF con i grafici in layout professionale 2x3 */
async function generaChartsPage(pdf) {
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;
  const marginY = 15;
  const usableWidth = pageWidth - 2 * marginX;
  const usableHeight = pageHeight - marginY * 2 - 20;

  // Header con titolo e info
  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(79, 70, 229); // Indigo
  pdf.text('Andamento Storicizzato', marginX, marginY + 8);

  // Nome paziente
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(70, 85, 137); // Text secondary
  const nomePaziente = currentPatient?.nominativo || 'PAZIENTE';
  pdf.text(`Paziente: ${nomePaziente}`, marginX, marginY + 16);

  // Data generazione
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  const dataOggi = new Date().toLocaleDateString('it-IT');
  pdf.text(`Data: ${dataOggi}`, marginX, marginY + 22);

  // Linea separatore
  pdf.setDrawColor(200, 200, 200);
  pdf.line(marginX, marginY + 25, pageWidth - marginX, marginY + 25);

  let yPos = marginY + 32;
  const chartWidth = (usableWidth - 4) / 2;
  const chartHeight = (usableHeight - 35) / 2.5;

  // Funzione helper per catturare i grafici Canvas.js
  const captureChart = (chartId) => {
    const chartDiv = document.getElementById(chartId);
    if (!chartDiv) return null;
    const chartCanvas = chartDiv.querySelector('canvas');
    if (!chartCanvas) return null;
    return chartCanvas.toDataURL('image/png');
  };

  // Cattura tutti i 5 grafici
  const chartsData = [
    { id: 'chart-peso', label: 'Andamento Peso Corporeo (kg)' },
    { id: 'chart-bmi', label: 'Indice di Massa Corporea (BMI)' },
    { id: 'chart-composizione', label: 'Composizione Corporea (%)' },
    { id: 'chart-circonferenze-tronco', label: 'Circonferenze Principali (cm)' },
    { id: 'chart-pliche-trend', label: 'Trend Pliche Cutanee (mm)' },
  ];

  const chartsImages = chartsData.map(c => ({
    ...c,
    image: captureChart(c.id)
  }));

  // Layout a griglia 2 colonne
  let gridRow = 0;
  for (let i = 0; i < chartsImages.length; i++) {
    const chartData = chartsImages[i];
    if (!chartData.image) continue;

    const colIndex = i % 2;
    const xPos = marginX + (colIndex * (chartWidth + 4));

    if (colIndex === 0 && i > 0) {
      yPos += chartHeight + 12;
    }

    // Box background per il grafico
    pdf.setDrawColor(230, 235, 245);
    pdf.setFillColor(248, 250, 255);
    pdf.rect(xPos - 1, yPos - 4, chartWidth + 2, chartHeight + 8, 'F');

    // Titolo grafico
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(79, 70, 229); // Indigo
    pdf.text(chartData.label, xPos + 2, yPos);

    // Immagine grafico
    try {
      pdf.addImage(chartData.image, 'PNG', xPos, yPos + 3, chartWidth, chartHeight - 6);
    } catch (e) {
      console.error('Errore nel caricamento dell\'immagine del grafico:', e);
    }

    gridRow = Math.ceil((i + 1) / 2);
  }

  // Summary statistic box
  yPos = marginY + 32 + (gridRow * (chartHeight + 12)) + 8;
  
  if (yPos < pageHeight - 30) {
    pdf.setDrawColor(168, 85, 247);
    pdf.setFillColor(245, 240, 255);
    pdf.rect(marginX, yPos - 2, usableWidth, 20, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(79, 70, 229);
    pdf.text('📊 Numero di Visite Registrate', marginX + 4, yPos + 3);

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(168, 85, 247);
    pdf.text(`${cachedVisitsList.length}`, marginX + usableWidth - 15, yPos + 3);
  }

  // Footer professionale
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(160, 160, 160);
  pdf.text('Dashboard Nutrizione Elite | Dr. De Salvo', marginX, pageHeight - 8);
  pdf.text('Generato automaticamente dal sistema', pageWidth - marginX - 60, pageHeight - 8);
}
