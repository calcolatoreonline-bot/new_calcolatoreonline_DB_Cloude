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
let currentVisitDate = null;
let currentCalendarDate = new Date();
let cachedVisitsList = [];
let allPatientsCache = [];

// Formatta una data in YYYY-MM-DD usando i valori LOCALI (evita lo sfasamento di un giorno
// che si verifica con toISOString() nei fusi orari come quello italiano)
function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Estrae solo la parte YYYY-MM-DD da un valore data_visita del database,
// che a seconda del tipo di colonna può arrivare con orario/timezone appesi
function soloData(dateVal) {
  if (!dateVal) return '';
  return String(dateVal).split('T')[0];
}

// Istanze grafici moderni
let chartPeso = null, chartBmi = null, chartComp = null, chartCircTronco = null, chartPliche = null;
let chartRmrBmr = null, chartKgMassa = null, chartSommaPliche = null;

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
  document.getElementById('btn-pdf-composizione')?.addEventListener('click', scaricaPDFComposizione);
  document.getElementById('btn-pdf-progressione')?.addEventListener('click', scaricaPDFProgressione);

  // Calendario e navigazione visite
  document.getElementById('btn-add-visit')?.addEventListener('click', () => nuovaVisitaDaCalendario(null));
  document.getElementById('calendar-prev')?.addEventListener('click', () => cambiaMesseCalendario(-1));
  document.getElementById('calendar-next')?.addEventListener('click', () => cambiaMesseCalendario(1));
  document.getElementById('btn-prev-visit')?.addEventListener('click', navigateVisitaPrecedente);
  document.getElementById('btn-next-visit')?.addEventListener('click', navigateVisitaSuccessiva);

  // Modal modifica paziente
  document.getElementById('btn-close-edit-modal')?.addEventListener('click', chiudiModalEditPaziente);
  document.getElementById('modal-edit-overlay')?.addEventListener('click', chiudiModalEditPaziente);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', chiudiModalEditPaziente);
  document.getElementById('btn-save-edit-paziente')?.addEventListener('click', salvaModifichePatient);
  document.getElementById('btn-delete-paziente')?.addEventListener('click', eliminaPaziente);
}

function chiudiModale() {
  document.getElementById('modal-paziente')?.classList.add('hidden');
  document.getElementById('new-nominativo').value = '';
  document.getElementById('new-sesso').value = '';
  document.getElementById('new-nascita').value = '';
}

function chiudiModalEditPaziente() {
  document.getElementById('modal-edit-paziente')?.classList.add('hidden');
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
      <div class="rubrica-patient-card" data-id="${p.id}">
        <div class="rubrica-patient-card-main" data-id="${p.id}" data-name="${p.nominativo}" data-gender="${p.sesso}" data-birth="${p.data_nascita || ''}">
          <div class="rpc-avatar ${p.sesso.toLowerCase()}">${p.sesso}</div>
          <div class="rpc-details">
            <h4>${p.nominativo}</h4>
            <p>Nato/a il: <strong>${dataNascitaF}</strong></p>
          </div>
        </div>
        <button class="rpc-edit-btn" type="button" title="Modifica paziente">✏️</button>
      </div>
    `;
  }).join('');

  // Click sulla carta per selezionare paziente
  container.querySelectorAll('.rubrica-patient-card-main').forEach(card => {
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

  // Click sul pulsante di modifica
  container.querySelectorAll('.rpc-edit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const card = this.parentElement;
      const patientId = card.getAttribute('data-id');
      const patient = allPatientsCache.find(p => p.id === patientId);
      if (patient) {
        apriModalModificaPaziente(patient);
      }
    });
  });
}

function filtraPazientiInRubrica(e) {
  const query = e.target.value.toUpperCase().trim();
  if (!query) { renderListaPazientiRubrica(allPatientsCache); return; }
  renderListaPazientiRubrica(allPatientsCache.filter(p => p.nominativo.toUpperCase().includes(query)));
}

function apriModalModificaPaziente(patient) {
  const modal = document.getElementById('modal-edit-paziente');
  document.body.appendChild(modal); // garantisce che sia sempre l'ultimo elemento, quindi in cima a tutto
  document.getElementById('edit-nominativo').value = patient.nominativo;
  document.getElementById('edit-sesso').value = patient.sesso;
  document.getElementById('edit-nascita').value = patient.data_nascita || '';
  modal.dataset.patientId = patient.id;
  modal.classList.remove('hidden');
}

async function salvaModifichePatient() {
  const patientId = document.getElementById('modal-edit-paziente').dataset.patientId;
  const nominativo = document.getElementById('edit-nominativo').value.toUpperCase().trim();
  const sesso = document.getElementById('edit-sesso').value;
  const dataNascita = document.getElementById('edit-nascita').value || null;

  if (!nominativo || !sesso) {
    alert('⚠️ Campi obbligatori mancanti.');
    return;
  }

  if (!sbClient) return;

  try {
    const { error } = await sbClient.from('pazienti').update({
      nominativo,
      sesso,
      data_nascita: dataNascita
    }).eq('id', patientId);

    if (error) throw error;

    // Aggiorna cache
    const idx = allPatientsCache.findIndex(p => p.id === patientId);
    if (idx >= 0) {
      allPatientsCache[idx] = { id: patientId, nominativo, sesso, data_nascita: dataNascita };
    }

    // Se è il paziente selezionato, aggiorna anche currentPatient
    if (currentPatient && currentPatient.id === patientId) {
      currentPatient.nominativo = nominativo;
      currentPatient.sesso = sesso;
      currentPatient.data_nascita = dataNascita;
      document.getElementById('current-patient-name').textContent = nominativo;
    }

    chiudiModalEditPaziente();
    alert('✅ Paziente modificato con successo!');

    // Ricarica rubrica
    await apriRubricaBanner();
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
}

async function eliminaPaziente() {
  const patientId = document.getElementById('modal-edit-paziente').dataset.patientId;
  const confirmDelete = confirm('⚠️ Sei sicuro di voler eliminare questo paziente? Questa azione è irreversibile.');

  if (!confirmDelete) return;

  if (!sbClient) return;

  try {
    // Elimina tutte le visite del paziente
    await sbClient.from('visite').delete().eq('paziente_id', patientId);

    // Elimina il paziente
    const { error } = await sbClient.from('pazienti').delete().eq('id', patientId);

    if (error) throw error;

    chiudiModalEditPaziente();
    alert('✅ Paziente eliminato con successo!');

    // Se era il paziente selezionato, resetta
    if (currentPatient && currentPatient.id === patientId) {
      currentPatient = null;
      currentVisitId = null;
      currentVisitDate = null;
      cachedVisitsList = [];
      document.getElementById('current-patient-name').textContent = 'Seleziona un paziente per iniziare';
      document.getElementById('patient-gender-badge').textContent = '';
      document.getElementById('form-valutazione').reset();
    }

    // Ricarica rubrica
    await apriRubricaBanner();
  } catch (err) {
    alert('❌ Errore: ' + err.message);
  }
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
  
  // Inizializza calendario sulla data odierna
  currentCalendarDate = new Date();
  currentVisitDate = formatDateLocal(new Date());
  currentVisitId = null;
  renderCalendar();
  
  document.getElementById('form-valutazione').reset();
  document.getElementById('in-laf').value = '1.375';
  autoCompilaEtaIniziale();
  aggiornaVisitCounter();
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
  } catch (err) { console.error(err); }
}

// ═════════════════════════════════════════════════════════════════════════════════
// CALENDARIO VISITE
// ═════════════════════════════════════════════════════════════════════════════════

function renderCalendar() {
  if (!currentPatient) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  document.getElementById('calendar-month-year').textContent = `${monthNames[month]} ${year}`;

  const calendarGrid = document.getElementById('calendar-grid');
  calendarGrid.innerHTML = '';

  // Intestazioni giorni
  const dayHeaders = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  dayHeaders.forEach(day => {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day-header';
    dayEl.textContent = day;
    calendarGrid.appendChild(dayEl);
  });

  // Primo giorno del mese
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  // Giorni vuoti all'inizio
  for (let i = 0; i < startingDayOfWeek; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    calendarGrid.appendChild(emptyDay);
  }

  const today = new Date();
  const todayStr = formatDateLocal(today);

  // Giorni del mese
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    const dateObj = new Date(year, month, day);
    const dateStr = formatDateLocal(dateObj);

    dayEl.className = 'calendar-day';
    dayEl.textContent = day;
    dayEl.dataset.date = dateStr;

    // Controlla se è oggi
    if (dateObj.toDateString() === today.toDateString()) {
      dayEl.classList.add('today');
    }

    // Controlla se ha una visita passata già salvata nel database
    const hasVisit = cachedVisitsList.some(v => soloData(v.data_visita) === dateStr);
    if (hasVisit && dateStr < todayStr) {
      dayEl.classList.add('has-visit');
    }

    // Selezionato
    if (currentVisitDate && dateStr === currentVisitDate) {
      dayEl.classList.add('selected');
    }

    dayEl.addEventListener('click', () => selectVisitaFromCalendar(dateStr));
    calendarGrid.appendChild(dayEl);
  }
}

function cambiaMesseCalendario(direction) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
  renderCalendar();
}

function selectVisitaFromCalendar(dateStr) {
  const visita = cachedVisitsList.find(v => soloData(v.data_visita) === dateStr);

  if (visita) {
    currentVisitId = visita.id;
    currentVisitDate = dateStr;
    renderCalendar();
    caricaDatiVisitaSingola(currentVisitId);
  } else {
    // Nessuna visita in questa data, prepara per nuova visita
    currentVisitId = null;
    currentVisitDate = dateStr;
    renderCalendar();
    document.getElementById('form-valutazione').reset();
    document.getElementById('in-laf').value = '1.375';
    autoCompilaEtaIniziale();
  }
  aggiornaVisitCounter();
}

function nuovaVisitaDaCalendario(date) {
  if (date) {
    currentVisitDate = date;
  } else {
    currentVisitDate = formatDateLocal(new Date());
  }
  currentVisitId = null;
  currentCalendarDate = new Date(currentVisitDate);
  renderCalendar();
  document.getElementById('form-valutazione').reset();
  document.getElementById('in-laf').value = '1.375';
  autoCompilaEtaIniziale();
  aggiornaVisitCounter();
}

function aggiornaVisitCounter() {
  if (!currentVisitDate) {
    document.getElementById('visit-counter').textContent = '';
    return;
  }

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  const indexCorrente = visite.findIndex(v => soloData(v.data_visita) === currentVisitDate);

  if (indexCorrente >= 0) {
    document.getElementById('visit-counter').textContent = `${indexCorrente + 1} / ${visite.length}`;
  } else {
    document.getElementById('visit-counter').textContent = `Nuova`;
  }
}

function navigateVisitaPrecedente() {
  if (!currentPatient || cachedVisitsList.length === 0) return;

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  let indexCorrente = visite.findIndex(v => currentVisitDate && soloData(v.data_visita) === currentVisitDate);

  if (indexCorrente <= 0) return;

  const visitaPrecedente = visite[indexCorrente - 1];
  selectVisitaFromCalendar(soloData(visitaPrecedente.data_visita));
}

function navigateVisitaSuccessiva() {
  if (!currentPatient || cachedVisitsList.length === 0) return;

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  let indexCorrente = visite.findIndex(v => currentVisitDate && soloData(v.data_visita) === currentVisitDate);

  if (indexCorrente < 0 || indexCorrente >= visite.length - 1) return;

  const visitaSuccessiva = visite[indexCorrente + 1];
  selectVisitaFromCalendar(soloData(visitaSuccessiva.data_visita));
}


/* 📊 LOGICA COSTRUZIONE GRAFICI DIVISI PER PAGINA */
function renderingGraficiElite(visite) {
  if (!visite || visite.length === 0) return;
  const labels = visite.map(v => new Date(v.data_visita).toLocaleDateString('it-IT'));
  const sesso = currentPatient.sesso;
  
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

  // ═══ PAGINA 1 ═══
  
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

  // 2. RMR + BMR
  const rmrValues = visite.map(v => sesso === 'M' ? (66.473 + 13.7516 * v.peso + 5.0033 * v.altezza - 6.755 * v.eta) : (655.0955 + 9.5634 * v.peso + 1.8496 * v.altezza - 4.6756 * v.eta));
  const bmrValues = visite.map(v => sesso === 'M' ? (10 * v.peso + 6.25 * v.altezza - 5 * v.eta + 5) : (10 * v.peso + 6.25 * v.altezza - 5 * v.eta - 161));
  chartRmrBmr = new Chart(document.getElementById('chart-rmr-bmr').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'RMR (kcal)',
          data: rmrValues,
          borderColor: COLORS.amber,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          fill: true,
          pointBorderColor: COLORS.amber,
        },
        {
          label: 'BMR (kcal)',
          data: bmrValues,
          borderColor: COLORS.sky,
          backgroundColor: 'transparent',
          fill: false,
          pointBorderColor: COLORS.sky,
        }
      ]
    },
    options: configComune
  });
  renderStatsWidget('stats-rmr-bmr', rmrValues, 'kcal');

  // 3. % COMPOSIZIONE
  const fmData = [];
  const ffmData = [];
  visite.forEach(v => {
    const eta = v.eta || 30;
    let somma = sesso === 'M'
      ? (v.p_pettorale||0)+(v.p_ascellare||0)+(v.p_addome||0)+(v.p_soprailiaca||0)+(v.p_tricipitale||0)+(v.p_sottoscapolare||0)+(v.p_coscia||0)
      : (v.p_addome||0)+(v.p_soprailiaca||0)+(v.p_tricipitale||0)+(v.p_sottoscapolare||0)+(v.p_coscia||0);
    if (somma > 0) {
      let bd = sesso === 'M'
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

  // 4. KG MASSA
  const fmKgData = visite.map((v, i) => fmData[i] ? (v.peso * fmData[i]) / 100 : null);
  const ffmKgData = visite.map((v, i) => fmData[i] ? v.peso - fmKgData[i] : null);
  chartKgMassa = new Chart(document.getElementById('chart-kg-massa').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Kg Massa Grassa',
          data: fmKgData,
          borderColor: COLORS.rose,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointBorderColor: COLORS.rose,
        },
        {
          label: 'Kg Massa Magra',
          data: ffmKgData,
          borderColor: COLORS.emerald,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          pointBorderColor: COLORS.emerald,
        }
      ]
    },
    options: configComune
  });
  renderStatsWidget('stats-kg-massa', fmKgData, 'kg');

  // ═══ PAGINA 2 - PLICHE ═══
  
  const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
  const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_addome', 'p_coscia', 'p_ascellare'];
  const plicheFields = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;
  
  const sommaPliche = visite.map(v => plicheFields.reduce((sum, f) => sum + (v[f] || 0), 0));
  
  // Somma Pliche
  chartSommaPliche = new Chart(document.getElementById('chart-somma-pliche').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Somma Pliche (mm)',
        data: sommaPliche,
        borderColor: COLORS.amber,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        fill: true,
        pointBorderColor: COLORS.amber,
      }]
    },
    options: configComune
  });
  renderStatsWidget('stats-somma-pliche', sommaPliche, 'mm');

  // Pliche Accoppiate per UOMO
  if (sesso === 'M') {
    const p_pettorale = visite.map(v => v.p_pettorale || 0);
    const p_ascellare = visite.map(v => v.p_ascellare || 0);
    const p_addome = visite.map(v => v.p_addome || 0);
    const p_soprailiaca = visite.map(v => v.p_soprailiaca || 0);
    const p_tricipitale = visite.map(v => v.p_tricipitale || 0);
    const p_sottoscapolare = visite.map(v => v.p_sottoscapolare || 0);
    const p_coscia = visite.map(v => v.p_coscia || 0);

    new Chart(document.getElementById('chart-pliche-1-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Pettorale', data: p_pettorale, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Ascellare', data: p_ascellare, borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-1-uomo', p_pettorale, 'mm');

    new Chart(document.getElementById('chart-pliche-2-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Addome', data: p_addome, borderColor: COLORS.sky, backgroundColor: 'rgba(14, 165, 233, 0.08)', fill: true, pointBorderColor: COLORS.sky },
        { label: 'Soprailiaca', data: p_soprailiaca, borderColor: COLORS.rose, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.rose }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-2-uomo', p_addome, 'mm');

    new Chart(document.getElementById('chart-pliche-3-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Tricipitale', data: p_tricipitale, borderColor: COLORS.emerald, backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: true, pointBorderColor: COLORS.emerald },
        { label: 'Sottoscapolare', data: p_sottoscapolare, borderColor: COLORS.amber, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.amber }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-3-uomo', p_tricipitale, 'mm');

    new Chart(document.getElementById('chart-pliche-4-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Coscia', data: p_coscia, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-4-uomo', p_coscia, 'mm');
  } else {
    // Pliche Accoppiate per DONNA
    const p_tricipitale = visite.map(v => v.p_tricipitale || 0);
    const p_soprailiaca = visite.map(v => v.p_soprailiaca || 0);
    const p_addome = visite.map(v => v.p_addome || 0);
    const p_coscia = visite.map(v => v.p_coscia || 0);
    const p_ascellare = visite.map(v => v.p_ascellare || 0);

    new Chart(document.getElementById('chart-pliche-1-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Tricipitale', data: p_tricipitale, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Soprailiaca', data: p_soprailiaca, borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-1-donna', p_tricipitale, 'mm');

    new Chart(document.getElementById('chart-pliche-2-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Addome', data: p_addome, borderColor: COLORS.sky, backgroundColor: 'rgba(14, 165, 233, 0.08)', fill: true, pointBorderColor: COLORS.sky },
        { label: 'Ascellare', data: p_ascellare, borderColor: COLORS.rose, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.rose }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-2-donna', p_addome, 'mm');

    new Chart(document.getElementById('chart-pliche-3-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Coscia', data: p_coscia, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-pliche-3-donna', p_coscia, 'mm');
  }

  // ═══ PAGINA 3 - CIRCONFERENZE ═══
  
  const c_torace = visite.map(v => v.c_torace || 0);
  const c_vita = visite.map(v => v.c_vita || 0);
  const c_fianchi = visite.map(v => v.c_fianchi || 0);
  const c_gluteo = visite.map(v => v.c_gluteo || 0);
  const c_braccio = visite.map(v => v.c_braccio || 0);
  const c_coscia = visite.map(v => v.c_coscia || 0);

  if (sesso === 'M') {
    new Chart(document.getElementById('chart-circ-1-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Torace', data: c_torace, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Vita', data: c_vita, borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet },
        { label: 'Fianchi', data: c_fianchi, borderColor: COLORS.sky, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.sky }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-circ-1-uomo', c_torace, 'cm');
  } else {
    new Chart(document.getElementById('chart-circ-1-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Vita', data: c_vita, borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Fianchi', data: c_fianchi, borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet },
        { label: 'Gluteo', data: c_gluteo, borderColor: COLORS.sky, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.sky }
      ]},
      options: configComune
    });
    renderStatsWidget('stats-circ-1-donna', c_vita, 'cm');
  }

  new Chart(document.getElementById('chart-circ-braccio').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Braccio', data: c_braccio, borderColor: COLORS.emerald, backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: true, pointBorderColor: COLORS.emerald },
      { label: 'Coscia', data: c_coscia, borderColor: COLORS.amber, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.amber }
    ]},
    options: configComune
  });
  renderStatsWidget('stats-circ-braccio', c_braccio, 'cm');

  // Nascondi i grafici che non corrispondono al sesso del paziente
  if (sesso === 'M') {
    // Maschio: nascondi i grafici femminili
    document.querySelectorAll('[data-gender="donna"]').forEach(el => el.style.display = 'none');
  } else {
    // Donna: nascondi i grafici maschili
    document.querySelectorAll('[data-gender="uomo"]').forEach(el => el.style.display = 'none');
  }

  document.getElementById('charts-section').classList.remove('hidden');
  document.getElementById('charts-section-pliche').classList.remove('hidden');
  document.getElementById('charts-section-circonferenze').classList.remove('hidden');
}

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
    data_visita: currentVisitDate || formatDateLocal(new Date())
  };

  if (!sbClient) return;
  try {
    let res = currentVisitId
      ? await sbClient.from('visite').update(payload).eq('id', currentVisitId).select()
      : await sbClient.from('visite').insert([payload]).select();
    if (res.error) throw res.error;
    
    if (!currentVisitId && res.data && res.data[0]) {
      currentVisitId = res.data[0].id;
    }
    
    alert('✅ Visita salvata con successo.');
    
    document.getElementById('preview-area').classList.add('hidden');
    document.getElementById('charts-section').classList.remove('hidden');
    
    await caricaStoricoVisite(currentPatient.id);
    renderCalendar();
    aggiornaVisitCounter();
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
  document.getElementById('charts-section-pliche').classList.remove('hidden');
  document.getElementById('charts-section-circonferenze').classList.remove('hidden');

  // Filtra le visite fino a quella selezionata nel calendario
  let vistePerGrafici = cachedVisitsList;
  
  if (currentVisitId) {
    const dataSelezionata = cachedVisitsList.find(x => x.id === currentVisitId);
    if (dataSelezionata) {
      vistePerGrafici = cachedVisitsList.filter(v => {
        const dataV = new Date(v.data_visita).getTime();
        return dataV <= new Date(dataSelezionata.data_visita).getTime();
      });
    }
  }
  
  // Genera i grafici con i dati filtrati
  renderingGraficiElite(vistePerGrafici);

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
    // BMR: IDENTICO (non cambia)
    let bmr = sesso === 'M' ? (10 * peso + 6.25 * altezza - 5 * eta + 5) : (10 * peso + 6.25 * altezza - 5 * eta - 161);
    
    // RMR: CORRETTO - Formula donna è diversa da uomo
    let rmr;
    if (sesso === 'M') {
      rmr = 66.473 + 13.7516 * peso + 5.0033 * altezza - 6.755 * eta;
    } else {
      // FORMULA DONNA CORRETTA (da calcolatore_vecchio.html)
      rmr = 655.0955 + 9.5634 * peso + 1.8496 * altezza - 4.6756 * eta;
    }
    
    bmrV = Math.round(bmr) + " kcal";
    rmrV = Math.round(rmr) + " kcal";
    tdeeV = Math.round(bmr * laf) + " kcal";    // USA BMR (non RMR) - CORRETTO
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

/* 📥 DOWNLOAD PDF 1 - COMPOSIZIONE CORPOREA E FABBISOGNI ENERGETICI */
async function scaricaPDFComposizione() {
  const btn = document.getElementById('btn-pdf-composizione');
  btn.disabled = true;
  btn.textContent = '⏳ Generazione...';
  
  const wraps = document.querySelectorAll('.pg-wrap');
  const watermarks = document.querySelectorAll('.wmark');
  const vecchieTrasformazioni = [];
  const isMobile = window.innerWidth <= 820;

  wraps.forEach(el => { vecchieTrasformazioni.push(el.style.transform); el.style.transform = 'none'; });
  if (isMobile) watermarks.forEach(wm => wm.style.setProperty('width', '502px', 'important'));

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const nomePaziente = currentPatient?.nominativo || 'PAZIENTE';
    const oggi = new Date();
    const dataAA = String(oggi.getFullYear()).slice(-2);
    const dataNome = [oggi.getDate(), oggi.getMonth() + 1, dataAA].map(x => String(x).padStart(2, '0')).join('-');
    
    const canvas1 = await html2canvas(document.getElementById('pdf-p1'), {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
      width: 794, height: 1123, windowWidth: 794, windowHeight: 1123
    });
    const img1 = canvas1.toDataURL('image/jpeg', 0.97);
    pdf.addImage(img1, 'JPEG', 0, 0, 210, 297);

    const canvas2 = await html2canvas(document.getElementById('pdf-p2'), {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
      width: 794, height: 1123, windowWidth: 794, windowHeight: 1123
    });
    const img2 = canvas2.toDataURL('image/jpeg', 0.97);
    pdf.addPage();
    pdf.addImage(img2, 'JPEG', 0, 0, 210, 297);

    pdf.save(`${nomePaziente} - Composizione corporea e Fabbisogni energetici ${dataNome}.pdf`);
  } catch (e) {
    console.error(e);
    alert('❌ Errore durante la generazione del PDF.');
  }

  if (isMobile) watermarks.forEach(wm => wm.style.removeProperty('width'));
  wraps.forEach((el, index) => el.style.transform = vecchieTrasformazioni[index]);
  btn.disabled = false;
  btn.textContent = '📥 Scarica Composizione Corporea';
}

/* 📥 DOWNLOAD PDF 2 - PROGRESSIONE ANTROPOMETRICA CON GRAFICI */
async function scaricaPDFProgressione() {
  const btn = document.getElementById('btn-pdf-progressione');
  btn.disabled = true;
  btn.textContent = '⏳ Generazione...';
  
  try {
    const { jsPDF } = window.jspdf;
    const nomePaziente = currentPatient?.nominativo || 'PAZIENTE';
    const oggi = new Date();
    const dataAA = String(oggi.getFullYear()).slice(-2);
    const dataNome = [oggi.getDate(), oggi.getMonth() + 1, dataAA].map(x => String(x).padStart(2, '0')).join('-');
    const dataFull = [oggi.getDate(), oggi.getMonth() + 1, oggi.getFullYear()].map(x => String(x).padStart(2, '0')).join('-');
    
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // Genera Pagine e Grafici
    await generaHeaderProgressione(pdf, dataFull);
    await generaGraficiProgressione(pdf);

    pdf.save(`${nomePaziente} - Progressione Antropometrica ${dataNome}.pdf`);
  } catch (e) {
    console.error(e);
    alert('❌ Errore durante la generazione del PDF.');
  }

  btn.disabled = false;
  btn.textContent = '📥 Scarica Progressione';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES GRAFICHE (PROPORZIONI REALI E TRASPARENZA PNG)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function aggiungiImmagineGlobal(pdf, src, x, y, w, h) {
  try {
    const imgEl = new Image();
    imgEl.src = src;
    imgEl.crossOrigin = 'anonymous';
    
    await new Promise((resolve, reject) => {
      imgEl.onload = resolve;
      imgEl.onerror = reject;
      setTimeout(resolve, 600);
    });

    const canvas = document.createElement('canvas');
    canvas.width = imgEl.width;
    canvas.height = imgEl.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    
    const isPng = src.toLowerCase().includes('.png') || src.toLowerCase().includes('transparent');
    const format = isPng ? 'image/png' : 'image/jpeg';
    const pdfFormat = isPng ? 'PNG' : 'JPEG';
    
    const imgData = canvas.toDataURL(format, isPng ? undefined : 0.97);
    pdf.addImage(imgData, pdfFormat, x, y, w, h);
    return true;
  } catch (err) {
    console.warn('Errore caricamento immagine:', src, err);
    return false;
  }
}

async function aggiungiWatermark(pdf, isFirstPage = false) {
  const pageWidth = 210;
  const pageHeight = 297;
  const wmWidth = 135;
  
  pdf.setGState(new window.jspdf.GState({ opacity: 0.04 }));
  
  try {
    const imgEl = new Image();
    imgEl.src = FILES.logo;
    imgEl.crossOrigin = 'anonymous';
    await new Promise((resolve) => { imgEl.onload = resolve; imgEl.onerror = resolve; });
    
    if (imgEl.width > 0) {
      // CALCOLO RAPPORTO D'ASPETTO NATIVO (Evita l'effetto allungato o schiacciato)
      const aspectRatio = imgEl.width / imgEl.height;
      const wmHeight = wmWidth / aspectRatio;
      
      // Centratura perfetta sia orizzontale che verticale nell'A4
      const xCentrato = (pageWidth - wmWidth) / 2;
      let yCentrato = (pageHeight - wmHeight) / 2;
      
      // Se è la prima pagina, sposta il watermark più in basso (+20mm)
      if (isFirstPage) {
        yCentrato += 20;
      }
      
      await aggiungiImmagineGlobal(pdf, FILES.logo, xCentrato, yCentrato, wmWidth, wmHeight);
    }
  } catch (e) {
    console.error('Errore nel disegno del watermark:', e);
  }
  
  pdf.setGState(new window.jspdf.GState({ opacity: 1.0 }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROGRESSIONE ANTROPOMETRICA: HEADER E GRAFICI (LOGICHE DI CALCOLO INALTERATE)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function calcolaDensitaVisita(visita) {
  const sesso = currentPatient.sesso;
  let somma = 0;
  // LOGICA MEDICA INTOCCABILE
  if (sesso === 'M') {
    somma = (visita.p_pettorale || 0) + (visita.p_ascellare || 0) + (visita.p_addome || 0) + (visita.p_soprailiaca || 0) + (visita.p_tricipitale || 0) + (visita.p_sottoscapolare || 0) + (visita.p_coscia || 0);
    return 1.112 - (0.00043499 * somma) + (0.00000055 * Math.pow(somma, 2)) - (0.00028826 * visita.eta);
  } else {
    somma = (visita.p_tricipitale || 0) + (visita.p_soprailiaca || 0) + (visita.p_addome || 0) + (visita.p_coscia || 0) + (visita.p_ascellare || 0);
    return 1.0994921 - (0.0009929 * somma) + (0.0000023 * Math.pow(somma, 2)) - (0.0001392 * visita.eta);
  }
}

async function generaHeaderProgressione(pdf, dataFull) {
  const pageWidth = 210;
  const marginX = 10;
  const marginY = 10;
  const sesso = currentPatient.sesso;

  // 1. Sfondo filigrana trasparente
  await aggiungiWatermark(pdf, true);

  // 2. Silhouette laterali simmetriche
  const imagePath = sesso === 'M' ? FILES.eliteM : FILES.eliteF;
  const imgWidth = 50;
  const imgHeight = 65; // Aumentato da 60 a 65 (0.5cm in più)
  const yTopImmagini = marginY;

  await aggiungiImmagineGlobal(pdf, imagePath, marginX, yTopImmagini, imgWidth, imgHeight);
  await aggiungiImmagineGlobal(pdf, imagePath, pageWidth - marginX - imgWidth, yTopImmagini, imgWidth, imgHeight);
  
  // 3. Logo Centrale Nero proporzionato al millimetro (Stesse dimensioni del report principale)
  try {
    const imgEl = new Image();
    imgEl.src = FILES.logo;
    imgEl.crossOrigin = 'anonymous';
    await new Promise((resolve) => { imgEl.onload = resolve; imgEl.onerror = resolve; });
    
    if (imgEl.width > 0) {
      const aspectRatio = imgEl.width / imgEl.height;
      const logoWidth = 40; // Ridotto da 50 a 40
      const logoHeight = logoWidth / aspectRatio;
      const xLogo = (pageWidth - logoWidth) / 2;
      const yLogo = yTopImmagini + 8; 
      
      await aggiungiImmagineGlobal(pdf, FILES.logo, xLogo, yLogo, logoWidth, logoHeight);
    }
  } catch (e) {
    console.error('Errore rendering logo intestazione:', e);
  }

  // 4. Dati Anagrafici dell'Atleta (SOTTO IL LOGO NERO)
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 58, 138);
  pdf.text(`ATLETA: ${currentPatient.nominativo.toUpperCase()}`, pageWidth / 2, 61, { align: 'center' });

  // 5. Data di elaborazione (ANCORA SOTTO)
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Data di elaborazione: ${dataFull}`, pageWidth / 2, 65, { align: 'center' });

  // 6. Barra dei Titoli Geometrica (Stile Elite - Deep Navy) - PIÙ STRETTA
  pdf.setFillColor(30, 58, 138); 
  pdf.rect(0, 81, pageWidth, 17, 'F'); // Ridotta da 20 a 17

  // 7. Titolo con font ancora più piccolo
  pdf.setFontSize(18); // Ridotto da 20 a 18
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('PROGRESSIONE ANTROPOMETRICA', pageWidth / 2, 92, { align: 'center' });
}

async function generaGraficiProgressione(pdf) {
  try {
    let visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
    if (!visite || visite.length === 0) {
      console.warn('Nessuna visita disponibile per i grafici');
      return;
    }

    const sesso = currentPatient?.sesso || 'M';
    const pageWidth = 210;
    const pageHeight = 297;
    const marginL = 16;
    const marginR = 16;
    const marginT = 15;
    const marginB = 12;
    const contentWidth = pageWidth - marginL - marginR;
    
    // Colore sfondo violaceo (240, 230, 250)
    const bgViolet = [240, 230, 250];
    const padding = 2; // Padding interno per sfondo
    
    // Titolo sezione style
    const renderSectionTitle = (title, y) => {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 58, 138); // Deep navy
      pdf.text(title, marginL, y);
      
      // Underline decorativo
      pdf.setDrawColor(30, 58, 138);
      pdf.setLineWidth(0.5);
      pdf.line(marginL, y + 3, marginL + 80, y + 3);
      pdf.setLineWidth(0.2);
      
      return y + 12;
    };

    // Funzione per aggiungere sfondo e grafico
    const addChartWithBackground = (canvasEl, x, y, width, height) => {
      if (canvasEl && canvasEl?.width > 0 && canvasEl?.height > 0) {
        try {
          // Sfondo violaceo
          pdf.setFillColor(bgViolet[0], bgViolet[1], bgViolet[2]);
          pdf.rect(x - padding, y - padding, width + (padding * 2), height + (padding * 2), 'F');
          
          // Grafico
          const imgData = canvasEl.toDataURL('image/png');
          if (imgData && imgData.length > 0) {
            pdf.addImage(imgData, 'PNG', x, y, width, height);
          }
          return true;
        } catch (e) {
          console.error(`Errore aggiunta grafico:`, e);
          return false;
        }
      }
      return false;
    };

    // Dimensioni grafici (come plicometrica)
    const miniChartWidth = (contentWidth - 6) / 2;
    const miniChartHeight = 45;
    const gap = 6;

    // ═══════════════════════════════════════════════════════════════════
    // PAGINA 1: METRICHE CORPOREE - 2x2 Grid
    // ═══════════════════════════════════════════════════════════════════
    
    let currentY = 113;
    
    currentY = renderSectionTitle('METRICHE CORPOREE', currentY);
    currentY += 8;

    // Grid 2x2: Peso, RMR+BMR, Composizione, Kg Massa
    const page1Charts = ['chart-peso', 'chart-rmr-bmr', 'chart-composizione', 'chart-kg-massa'];
    let gridY = currentY;
    let gridX = marginL;

    for (let i = 0; i < page1Charts.length; i++) {
      const canvasEl = document.getElementById(page1Charts[i]);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);

      // Layout 2x2: posizionamento
      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + gap + 4; // +4 per spazio tra righe
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PAGINA 2: ANALISI PLICOMETRICA
    // ═══════════════════════════════════════════════════════════════════

    pdf.addPage();
    await aggiungiWatermark(pdf);
    currentY = marginT;

    currentY = renderSectionTitle('ANALISI PLICOMETRICA', currentY);
    currentY += 8;

    // Somma Pliche - Full width prominente
    const canvasSomma = document.getElementById('chart-somma-pliche');
    if (canvasSomma && canvasSomma?.width > 0 && canvasSomma?.height > 0) {
      try {
        const sommaHeight = 60;
        // Sfondo violaceo full width
        pdf.setFillColor(bgViolet[0], bgViolet[1], bgViolet[2]);
        pdf.rect(marginL - padding, currentY - padding, contentWidth + (padding * 2), sommaHeight + (padding * 2), 'F');
        
        const imgData = canvasSomma.toDataURL('image/png');
        if (imgData && imgData.length > 0) {
          pdf.addImage(imgData, 'PNG', marginL, currentY, contentWidth, sommaHeight);
          currentY += sommaHeight + 15;
        }
      } catch (e) {
        console.error('Errore Somma Pliche:', e);
      }
    }

    // Mini Pliche Grid 2x2 con sfondi
    const plicheChartIds = sesso === 'M'
      ? ['chart-pliche-1-uomo', 'chart-pliche-2-uomo', 'chart-pliche-3-uomo', 'chart-pliche-4-uomo']
      : ['chart-pliche-1-donna', 'chart-pliche-2-donna', 'chart-pliche-3-donna'];

    gridY = currentY;
    gridX = marginL;

    for (let i = 0; i < plicheChartIds.length; i++) {
      const canvasEl = document.getElementById(plicheChartIds[i]);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);

      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + gap + 4;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PAGINA 3: CIRCONFERENZE - 2x2 Grid
    // ═══════════════════════════════════════════════════════════════════

    pdf.addPage();
    await aggiungiWatermark(pdf);
    currentY = marginT;

    currentY = renderSectionTitle('CIRCONFERENZE', currentY);
    currentY += 8;

    // Grid 2x2: Circonferenze sesso + Braccio
    const circChartIds = sesso === 'M'
      ? ['chart-circ-1-uomo', 'chart-circ-braccio']
      : ['chart-circ-1-donna', 'chart-circ-braccio'];

    gridY = currentY;
    gridX = marginL;

    for (let i = 0; i < circChartIds.length; i++) {
      const canvasEl = document.getElementById(circChartIds[i]);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);

      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + gap + 4;
      }
    }

  } catch (err) {
    console.error('Errore critico generazione grafici PDF:', err);
    alert('⚠️ Errore durante la generazione dei grafici nel PDF. Verifica la console.');
  }
}

function aggiuntaMiniDashboard(pdf, yPos, valoreIniziale, valoreAttuale) {
  const pageWidth = 210;
  const marginX = 12;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(marginX, yPos, pageWidth - marginX, yPos);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(190, 18, 60); 
  pdf.text(valoreIniziale, marginX + 2, yPos + 4);
  pdf.setTextColor(21, 128, 61); 
  pdf.text(valoreAttuale, pageWidth - marginX - 2, yPos + 4, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
}

function aggiuntaMiniDashboardPlica(pdf, yPos, label, valoreIniziale, valoreAttuale) {
  const pageWidth = 210;
  const marginX = 12;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(70, 85, 137);
  pdf.text(`${label}: `, marginX + 2, yPos + 2);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(190, 18, 60);
  pdf.text(valoreIniziale, marginX + 50, yPos + 2);
  pdf.setTextColor(21, 128, 61);
  pdf.text(valoreAttuale, pageWidth - marginX - 2, yPos + 2, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
}