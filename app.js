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

// Palette Mini-Dashboard: un solo colore per categoria di grafico (invece del
// colore per-serie), per una lettura visiva più coerente e minimale
const COLORS_MINI_DASH = {
  metriche: COLORS.indigo,  // Peso, RMR+BMR, Composizione Corporea, Kg Massa
  pliche: COLORS.amber,     // Somma Pliche e tutte le pliche accoppiate
  misure: COLORS.sky,       // Circonferenze
};

// Numero massimo di visite mostrate sul grafico principale (le più recenti, fino alla visita selezionata)
const MAX_VISITE_GRAFICO = 8;

/* ══════════════════════════════════════════════════════════════════════════
   PLUGIN CHART.JS: evidenzia l'ultimo punto valido di ogni serie (visita
   selezionata) con una linea tratteggiata e il valore in chiaro. La lunghezza
   base della linea è pensata per essere sempre chiaramente visibile. Quando
   due o più etichette rischiano di toccarsi (valori vicini), una vera
   collision detection 2D (basata sulla larghezza/altezza reale del testo,
   non su distanze fisse indovinate) le allontana dinamicamente — verticalmente
   e/o orizzontalmente, il minimo indispensabile — finché non c'è più alcuna
   sovrapposizione tra le etichette né con il bordo del grafico. Se i valori
   sono già ben distanziati, ogni etichetta resta dritta sopra il proprio
   punto, senza spostamenti inutili. Registrato globalmente: si applica a
   tutti i grafici a linee esistenti senza modificare ogni singola istanza.
══════════════════════════════════════════════════════════════════════════ */
const evidenziaUltimoPuntoPlugin = {
  id: 'evidenziaUltimoPunto',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const datasets = chart.data.datasets || [];
    const limiteDestro = chart.width - 4;      // bordo del canvas: qui vive il corridoio riservato dal layout.padding.right
    const limiteAlto = chartArea.top + 6;      // non entrare mai nella zona della legenda
    const limiteBasso = chartArea.bottom - 4;  // non entrare mai nella zona delle etichette dell'asse X (date)
    const lineLengthBase = 30;                  // lunghezza della linea per un valore senza conflitti: ben visibile
    const margineSicurezza = 9;                 // respiro minimo tra due etichette (o tra etichetta e bordo/pallino): abbastanza ampio da leggersi bene, non solo "matematicamente" non sovrapposto
    const altezzaTesto = 14;                    // altezza approssimativa di una riga di testo alla dimensione usata (con margine di sicurezza incluso)
    const raggioPunto = 7;                      // zona di rispetto attorno al pallino di ogni serie (raggio visivo ~5px + margine), da non coprire mai con un'etichetta

    ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // Raccoglie l'ultimo valore valido (la visita selezionata) di ogni serie
    const punti = [];
    datasets.forEach((dataset, dsIndex) => {
      const data = dataset.data;
      if (!data) return;
      let idx = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        const v = data[i];
        if (v !== null && v !== undefined && !isNaN(v)) { idx = i; break; }
      }
      if (idx === -1) return;
      const meta = chart.getDatasetMeta(dsIndex);
      const point = meta.data[idx];
      if (!point) return;
      const valoreFormattato = data[idx].toFixed(1);
      punti.push({
        x: point.x, y: point.y, colore: dataset.borderColor || '#4f46e5',
        valoreFormattato, larghezzaTesto: ctx.measureText(valoreFormattato).width
      });
    });
    if (punti.length === 0) return;

    // Ordina dal valore più alto (y più piccola) al più basso: le etichette si piazzano in quest'ordine
    punti.sort((a, b) => a.y - b.y);

    // Calcola il rettangolo occupato da un'etichetta, dato il suo punto di ancoraggio orizzontale e l'allineamento
    const rettangolo = (xAncora, labelY, larghezzaTesto, allineamento) => {
      const left = allineamento === 'center' ? xAncora - larghezzaTesto / 2
        : allineamento === 'left' ? xAncora
        : xAncora - larghezzaTesto;
      return { left, right: left + larghezzaTesto, top: labelY - altezzaTesto, bottom: labelY };
    };

    const sovrapposti = (a, b) =>
      a.left < b.right + margineSicurezza && a.right > b.left - margineSicurezza &&
      a.top < b.bottom + margineSicurezza && a.bottom > b.top - margineSicurezza;

    // Zona di rispetto quadrata attorno al pallino di ciascuna serie: un'etichetta non deve
    // mai coprire il pallino DI UN'ALTRA serie (capita quando due linee si incrociano vicino
    // alla fine, es. due valori vicini che si scambiano di posizione), altrimenti il numero
    // diventa illeggibile sopra al marker colorato. Stessa logica di collisione già in uso.
    const zonePunti = punti.map(pt => ({
      punto: pt,
      box: { left: pt.x - raggioPunto, right: pt.x + raggioPunto, top: pt.y - raggioPunto, bottom: pt.y + raggioPunto }
    }));

    const piazzate = [];

    const etichette = punti.map(p => {
      let labelY = Math.max(p.y - lineLengthBase, limiteAlto);
      let xLinea = p.x;
      let allineamento = 'center';

      // Continua a spostare l'etichetta (preferendo SEMPRE lo spazio libero sopra la zona
      // in conflitto, e solo nei casi estremi quello sotto; se serve anche più a destra, e
      // se il bordo destro del grafico glielo impedisce allunga la linea in verticale)
      // finché non è libera da conflitti con ogni altra etichetta già piazzata E con il
      // pallino di ogni altra serie (il proprio pallino è escluso dal controllo).
      // Il vincolo del bordo destro viene ricontrollato AD OGNI TENTATIVO, non solo alla
      // fine: così un'etichetta "rimandata" al bordo non può mai ricadere su un'altra già
      // posizionata — se succede, il ciclo continua e la sposta ulteriormente.
      for (let tentativo = 0; tentativo < 20; tentativo++) {
        let box = rettangolo(xLinea, labelY, p.larghezzaTesto, allineamento);

        // Non uscire mai dal corridoio destro: se la posizione candidata sfora,
        // ancora il testo al bordo (allineato a destra) prima di validarla
        if (box.right > limiteDestro) {
          xLinea = limiteDestro;
          allineamento = 'right';
          box = rettangolo(xLinea, labelY, p.larghezzaTesto, allineamento);
        }

        // Non scendere mai nella zona delle date sotto il grafico: se la posizione
        // candidata sfora in basso, ancorala al fondo dell'area utile prima di validarla.
        // Ricontrollato ad ogni tentativo come il bordo destro: se anche da qui parte un
        // conflitto, l'etichetta scarterà ulteriormente a destra lungo questa riga invece
        // di continuare a scendere (nessun rischio di finire sopra le date)
        if (box.bottom > limiteBasso) {
          labelY = limiteBasso;
          box = rettangolo(xLinea, labelY, p.larghezzaTesto, allineamento);
        }

        // Quando l'etichetta è scartata lateralmente (non più "center"), il connettore
        // disegna anche un segmento ORIZZONTALE proprio all'altezza del punto (p.y): se il
        // testo finisce troppo vicino a quella riga, i trattini sembrano "bucare" i numeri.
        // Trattiamo quindi la fascia orizzontale del proprio connettore come un'altra zona
        // da evitare, con la stessa identica logica di collisione (solo verticale: la riga
        // del connettore passa comunque proprio dove finisce il testo, qualunque sia la x)
        const zonaConnettoreProprio = allineamento !== 'center'
          ? { left: -Infinity, right: Infinity, top: p.y - altezzaTesto / 2, bottom: p.y + altezzaTesto / 2 }
          : null;

        const conflitto = piazzate.find(q => sovrapposti(box, q.box))
          || zonePunti.find(z => z.punto !== p && sovrapposti(box, z.box))
          || (zonaConnettoreProprio && sovrapposti(box, zonaConnettoreProprio) ? { box: zonaConnettoreProprio } : null);
        if (!conflitto) {
          piazzate.push({ box });
          return { ...p, labelY, xLinea, allineamento };
        }

        // Se siamo già ancorati al bordo destro non c'è più spazio per scartare
        // lateralmente: l'unica via libera è allungare la linea in verticale
        if (allineamento !== 'right') {
          xLinea = Math.max(xLinea, conflitto.box.right + margineSicurezza + 6);
          allineamento = 'left';
        }

        // Preferisci SEMPRE spingere l'etichetta SOPRA la zona in conflitto: lo spazio
        // in alto del grafico è quasi sempre più libero di quello in basso, vicino alle
        // date sull'asse X. Si scende invece verso il basso solo nei casi estremi in cui
        // salire farebbe uscire l'etichetta dall'area utile (sopra la legenda/limiteAlto)
        const labelYSopra = conflitto.box.top - margineSicurezza;
        labelY = (labelYSopra - altezzaTesto >= limiteAlto)
          ? labelYSopra
          : conflitto.box.bottom + margineSicurezza + altezzaTesto;
      }

      // Rete di sicurezza (non dovrebbe mai servire dopo 20 tentativi): piazza comunque
      // l'ultima posizione calcolata, così l'etichetta non sparisce dal disegno
      const boxFinale = rettangolo(xLinea, labelY, p.larghezzaTesto, allineamento);
      piazzate.push({ box: boxFinale });
      return { ...p, labelY, xLinea, allineamento };
    });

    etichette.forEach(e => {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = e.colore;

      if (e.allineamento === 'center') {
        // Nessuno scarto laterale: linea dritta verso l'alto dal puntino
        ctx.moveTo(e.x, e.y - 5);
        ctx.lineTo(e.x, e.labelY + 4);
      } else {
        // Etichetta scartata lateralmente (per collisione o per il bordo destro):
        // scarto orizzontale dal puntino, poi risalita fino all'etichetta
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.xLinea, e.y);
        ctx.lineTo(e.xLinea, e.labelY + 4);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "700 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = e.colore;
      ctx.textBaseline = 'bottom';
      ctx.textAlign = e.allineamento;
      ctx.fillText(e.valoreFormattato, e.xLinea, e.labelY);

      ctx.restore();
    });
  }
};
if (window.Chart) Chart.register(evidenziaUltimoPuntoPlugin);

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
  document.getElementById('btn-elimina-visita')?.addEventListener('click', eliminaVisitaCorrente);
  document.getElementById('btn-calcola-report')?.addEventListener('click', elaboraA4EVisualizzaTutto);
  document.getElementById('btn-pdf-composizione')?.addEventListener('click', scaricaPDFComposizione);
  document.getElementById('btn-pdf-progressione')?.addEventListener('click', scaricaPDFProgressione);
  document.getElementById('btn-stampa-tutto')?.addEventListener('click', stampaTuttoReport);
  document.getElementById('btn-slide-instagram')?.addEventListener('click', scaricaSlideInstagram);
  document.getElementById('btn-scroll-to-bottom')?.addEventListener('click', () => {
    document.getElementById('sezione-riepilogo-narrativo')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
  document.getElementById('btn-sblocca-altezza')?.addEventListener('click', () => {
    const input = document.getElementById('in-altezza');
    if (!input) return;
    input.readOnly = false;
    input.classList.remove('campo-bloccato');
    input.focus();
  });

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

    // Evidenzia e porta in vista il paziente attualmente selezionato, se presente
    if (currentPatient) {
      const activeCard = document.querySelector('#rubrica-patients-container .rubrica-patient-card.active');
      if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
    const isActive = currentPatient && String(currentPatient.id) === String(p.id);
    return `
      <div class="rubrica-patient-card${isActive ? ' active' : ''}" data-id="${p.id}">
        <div class="rubrica-patient-card-main" data-id="${p.id}" data-name="${p.nominativo}" data-gender="${p.sesso}" data-birth="${p.data_nascita || ''}">
          <div class="rpc-avatar ${p.sesso.toLowerCase()}">${p.sesso}</div>
          <div class="rpc-details">
            <h4>${p.nominativo}${isActive ? ' <span class="rpc-active-badge">📍 Attivo</span>' : ''}</h4>
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
  document.getElementById('charts-section-pliche').classList.add('hidden');
  document.getElementById('charts-section-circonferenze').classList.add('hidden');
  document.getElementById('sezione-riepilogo-narrativo')?.classList.add('hidden');
  document.getElementById('btn-scroll-to-bottom')?.classList.add('hidden');
  window.scrollTo(0, 0);

  aggiornaFormUI(sesso);
  await caricaStoricoVisite(id);
  
  // Inizializza calendario sulla data odierna e verifica se esiste già una visita
  // salvata per oggi (se sì la carica, altrimenti prepara una bozza vuota)
  currentCalendarDate = new Date();
  selectVisitaFromCalendar(formatDateLocal(new Date()));
}

// Calcola l'età corretta a una data di riferimento (di norma la visita
// selezionata nel calendario, non "oggi"), tenendo conto di mese e giorno —
// non solo dell'anno, per non sbagliare di uno quando il compleanno non è
// ancora arrivato nell'anno di riferimento
function calcolaEtaAllaData(dataNascitaStr, dataRiferimentoStr) {
  const dataNascita = new Date(dataNascitaStr);
  const dataRiferimento = dataRiferimentoStr ? new Date(dataRiferimentoStr) : new Date();
  let eta = dataRiferimento.getFullYear() - dataNascita.getFullYear();
  const meseGiornoNascita = dataNascita.getMonth() * 100 + dataNascita.getDate();
  const meseGiornoRiferimento = dataRiferimento.getMonth() * 100 + dataRiferimento.getDate();
  if (meseGiornoRiferimento < meseGiornoNascita) eta--;
  return eta;
}

// Blocca il campo Altezza non appena trova un valore da una visita precedente
// (l'altezza di un adulto non cambia): il dottore può comunque sbloccarlo con
// l'icona 🔓 per correggere un errore — si ri-blocca da solo al prossimo
// cambio di visita o paziente. Nessuna modifica al database: il valore resta
// salvato per-visita come già oggi, cambia solo il comportamento del campo.
function applicaAltezzaFissa() {
  const input = document.getElementById('in-altezza');
  const btnSblocca = document.getElementById('btn-sblocca-altezza');
  if (!input || !btnSblocca) return;

  const visitaConAltezza = (cachedVisitsList && cachedVisitsList.length > 0)
    ? [...cachedVisitsList].reverse().find(v => v.altezza && v.altezza > 0)
    : null;

  if (visitaConAltezza) {
    if (!input.value) input.value = visitaConAltezza.altezza;
    input.readOnly = true;
    input.classList.add('campo-bloccato');
    btnSblocca.classList.remove('hidden');
  } else {
    input.readOnly = false;
    input.classList.remove('campo-bloccato');
    btnSblocca.classList.add('hidden');
  }
}

// Il Livello di Attività Fisica (LAF) va inserito una volta sola: da lì in poi il selettore
// propone di default l'ultimo valore scelto per questo paziente, esattamente come l'altezza,
// ma resta SEMPRE liberamente modificabile (nessun blocco/lucchetto). Se il dottore lo cambia
// su una nuova visita, quel nuovo valore diventa il default per le visite successive; le
// visite già salvate mantengono il proprio valore storico (nessuna modifica al database,
// cambia solo il valore proposto di default per una visita nuova).
function applicaLAFDefault() {
  const select = document.getElementById('in-laf');
  if (!select) return;
  const visitaConLAF = (cachedVisitsList && cachedVisitsList.length > 0)
    ? [...cachedVisitsList].reverse().find(v => v.laf)
    : null;
  select.value = visitaConLAF ? visitaConLAF.laf : '1.375';
}

function autoCompilaEtaIniziale() {
  if (!currentPatient) return;
  if (currentPatient.data_nascita) {
    // Età alla data della visita selezionata nel calendario (non a oggi): così una
    // visita retrodatata mostra l'età che il paziente aveva davvero in quel momento
    document.getElementById('in-eta').value = calcolaEtaAllaData(currentPatient.data_nascita, currentVisitDate);
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

    // Controlla se ha una visita già salvata nel database (oggi compresa: una
    // visita registrata nella data odierna deve restare verde anche quando la
    // cella non è quella attualmente selezionata)
    const hasVisit = cachedVisitsList.some(v => soloData(v.data_visita) === dateStr);
    if (hasVisit && dateStr <= todayStr) {
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
    applicaLAFDefault();
    autoCompilaEtaIniziale();
    applicaAltezzaFissa();
  }
  aggiornaVisitCounter();
  aggiornaStatoBottoniVisita();
}

function nuovaVisitaDaCalendario(date) {
  // La data/visita corrente è già determinata correttamente da selectVisitaFromCalendar
  // (al click su un giorno del calendario) o da selezionaPaziente (posizionamento su oggi).
  // Questo bottone si limita a portare l'utente al form per compilare la bozza.
  if (!currentPatient) { alert('⚠️ Seleziona un paziente attivo.'); return; }
  document.getElementById('section-visita-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function aggiornaVisitCounter() {
  if (!currentVisitDate) {
    document.getElementById('visit-counter').textContent = '';
    document.getElementById('visit-current-date').textContent = '';
    document.getElementById('visit-weight-diff').textContent = '';
    document.getElementById('visit-history-range').textContent = '';
    return;
  }

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  const indexCorrente = visite.findIndex(v => soloData(v.data_visita) === currentVisitDate);

  if (indexCorrente >= 0) {
    document.getElementById('visit-counter').textContent = `${indexCorrente + 1} / ${visite.length}`;
  } else {
    document.getElementById('visit-counter').textContent = `Nuova`;
  }

  const [anno, mese, giorno] = currentVisitDate.split('-');
  const badge = currentVisitId ? '🟢 Salvata' : '🟡 Bozza non salvata';
  document.getElementById('visit-current-date').textContent = `📅 ${giorno}/${mese}/${anno} · ${badge}`;

  // Variazione peso rispetto alla visita precedente
  const diffEl = document.getElementById('visit-weight-diff');
  const pesoCorrente = indexCorrente >= 0 ? parseFloat(visite[indexCorrente].peso) : (parseFloat(document.getElementById('in-peso')?.value) || null);
  const vistePrecedenti = visite.filter(v => soloData(v.data_visita) < currentVisitDate);
  const visitaPrecedente = vistePrecedenti[vistePrecedenti.length - 1];

  if (visitaPrecedente && pesoCorrente) {
    const diff = pesoCorrente - parseFloat(visitaPrecedente.peso);
    const icona = diff < 0 ? '⬇️' : (diff > 0 ? '⬆️' : '➡️');
    const segno = diff > 0 ? '+' : '';
    diffEl.textContent = `${icona} ${segno}${diff.toFixed(1)} kg rispetto alla visita precedente`;
    diffEl.className = 'visit-weight-diff' + (diff > 0 ? ' positivo' : diff < 0 ? ' negativo' : '');
  } else {
    diffEl.textContent = '';
    diffEl.className = 'visit-weight-diff';
  }

  // Altri dati in variazione rispetto alla visita precedente (BMI, sommatoria pliche, circonferenze)
  aggiornaVisitExtraDiff(visite, indexCorrente, visitaPrecedente);

  // Intervallo storico visite del paziente (solo visite realmente salvate: la bozza del
  // giorno odierno non salvata non compare mai, a meno che non sia l'ultima visita utile
  // effettivamente registrata)
  const rangeEl = document.getElementById('visit-history-range');
  if (visite.length > 0) {
    const [pAnno, pMese, pGiorno] = soloData(visite[0].data_visita).split('-');
    const [uAnno, uMese, uGiorno] = soloData(visite[visite.length - 1].data_visita).split('-');
    rangeEl.textContent = `Prima visita utile: ${pGiorno}/${pMese}/${pAnno} · Ultima visita utile: ${uGiorno}/${uMese}/${uAnno} (${visite.length} visite)`;
  } else {
    rangeEl.textContent = '';
  }
}

// ═════════════════════════════════════════════════════════════════════════════════
// CONFRONTO CON VISITA PRECEDENTE: BMI, SOMMATORIA PLICHE, CIRCONFERENZE
// ═════════════════════════════════════════════════════════════════════════════════

// Mappa circonferenze: campo DB <-> id input form <-> a quale sesso si applica
const CIRCONFERENZE_CONFIG = [
  { db: 'c_collo',             formId: 'c-collo',       label: 'Collo',       genders: ['M', 'F'] },
  { db: 'c_torace',            formId: 'c-torace',      label: 'Torace',      genders: ['M'] },
  { db: 'c_vita',               formId: 'c-vita',        label: 'Vita',        genders: ['M', 'F'] },
  { db: 'c_fianchi',           formId: 'c-fianchi',     label: 'Fianchi',     genders: ['M', 'F'] },
  { db: 'c_gluteo',            formId: 'c-gluteo',      label: 'Gluteo',      genders: ['F'] },
  { db: 'c_braccio',           formId: 'c-braccio-ril', label: 'Braccio Ril.', genders: ['M', 'F'] },
  { db: 'c_braccio_contratto', formId: 'c-braccio-con', label: 'Braccio Con.', genders: ['M', 'F'] },
  { db: 'c_coscia',            formId: 'c-coscia',      label: 'Coscia',      genders: ['M', 'F'] },
];

// Mappa pliche: campo DB <-> id input form <-> a quale sesso si applica
const PLICHE_CONFIG = [
  { db: 'p_pettorale',      formId: 'p-pettorale',      genders: ['M'] },
  { db: 'p_ascellare',      formId: 'p-ascellare',      genders: ['M'] },
  { db: 'p_addome',         formId: 'p-addome',         genders: ['M', 'F'] },
  { db: 'p_soprailiaca',    formId: 'p-soprailiaca',    genders: ['M', 'F'] },
  { db: 'p_tricipitale',    formId: 'p-tricipitale',    genders: ['M', 'F'] },
  { db: 'p_sottoscapolare', formId: 'p-sottoscapolare', genders: ['M', 'F'] },
  { db: 'p_coscia',         formId: 'p-coscia',         genders: ['M', 'F'] },
];

function valoreDaVisita(visitaObj, dbKey) {
  if (!visitaObj) return null;
  const v = visitaObj[dbKey];
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function valoreDaForm(formId) {
  const el = document.getElementById(formId);
  if (!el || el.value === '') return null;
  const n = parseFloat(el.value);
  return isNaN(n) ? null : n;
}

function creaPillDiff(label, diff, unit, decimals = 1) {
  if (diff === null || diff === undefined || isNaN(diff)) return '';
  const icona = diff < 0 ? '⬇️' : (diff > 0 ? '⬆️' : '➡️');
  const segno = diff > 0 ? '+' : '';
  const classe = diff > 0 ? 'positivo' : (diff < 0 ? 'negativo' : '');
  const unitaTxt = unit ? ` ${unit}` : '';
  return `<span class="diff-pill ${classe}">${icona} ${label}: ${segno}${diff.toFixed(decimals)}${unitaTxt}</span>`;
}

function sommaValoriConfig(getValoreFn, configList) {
  let somma = 0;
  let trovati = 0;
  configList.forEach(cfg => {
    const v = getValoreFn(cfg);
    if (v !== null) { somma += v; trovati++; }
  });
  return trovati > 0 ? somma : null;
}

function aggiornaVisitExtraDiff(visite, indexCorrente, visitaPrecedente) {
  const extraEl = document.getElementById('visit-extra-diff');
  if (!extraEl) return;

  if (!currentPatient || !visitaPrecedente) { extraEl.innerHTML = ''; return; }

  const sesso = currentPatient.sesso;
  const visitaCorrente = indexCorrente >= 0 ? visite[indexCorrente] : null;

  // Legge il valore corrente: dalla visita salvata se stiamo guardando una visita esistente,
  // altrimenti dai campi del form (bozza in compilazione)
  const getCorrente = (dbKey, formId) => visitaCorrente ? valoreDaVisita(visitaCorrente, dbKey) : valoreDaForm(formId);
  const getPrecedente = (dbKey) => valoreDaVisita(visitaPrecedente, dbKey);

  const pills = [];

  // BMI = peso (kg) / altezza (m)^2
  const altezzaCorrente = getCorrente('altezza', 'in-altezza');
  const pesoCorrenteBmi = getCorrente('peso', 'in-peso');
  const altezzaPrecedente = getPrecedente('altezza');
  const pesoPrecedente = getPrecedente('peso');
  if (altezzaCorrente && pesoCorrenteBmi && altezzaPrecedente && pesoPrecedente) {
    const bmiCorrente = pesoCorrenteBmi / Math.pow(altezzaCorrente / 100, 2);
    const bmiPrecedente = pesoPrecedente / Math.pow(altezzaPrecedente / 100, 2);
    pills.push(creaPillDiff('BMI', bmiCorrente - bmiPrecedente, '', 2));
  }

  // Sommatoria pliche cutanee (solo le pliche previste per il sesso del paziente).
  // Donna: protocollo Jackson & Pollock a 3 pliche (Tricipite, Soprailiaca, Coscia) —
  // Addome e Sottoscapolare restano campi validi ma sono esclusi da questa somma.
  const SOMMA_PLICHE_DONNA_DB = ['p_tricipitale', 'p_soprailiaca', 'p_coscia'];
  const plicheRilevanti = sesso === 'F'
    ? PLICHE_CONFIG.filter(p => SOMMA_PLICHE_DONNA_DB.includes(p.db))
    : PLICHE_CONFIG.filter(p => p.genders.includes(sesso));
  const sommaPlicheCorrente = sommaValoriConfig(p => getCorrente(p.db, p.formId), plicheRilevanti);
  const sommaPlichePrecedente = sommaValoriConfig(p => getPrecedente(p.db), plicheRilevanti);
  if (sommaPlicheCorrente !== null && sommaPlichePrecedente !== null) {
    pills.push(creaPillDiff('Σ Pliche', sommaPlicheCorrente - sommaPlichePrecedente, 'mm'));
  }

  // Circonferenze (solo quelle previste per il sesso del paziente)
  const circonferenzeRilevanti = CIRCONFERENZE_CONFIG.filter(c => c.genders.includes(sesso));
  circonferenzeRilevanti.forEach(c => {
    const vCorrente = getCorrente(c.db, c.formId);
    const vPrecedente = getPrecedente(c.db);
    if (vCorrente !== null && vPrecedente !== null) {
      pills.push(creaPillDiff(c.label, vCorrente - vPrecedente, 'cm'));
    }
  });

  const pillsHtml = pills.filter(Boolean).join('');
  extraEl.innerHTML = pillsHtml ? `<div class="extra-diff-wrap">${pillsHtml}</div>` : '';
}

function navigateVisitaPrecedente() {
  if (!currentPatient || cachedVisitsList.length === 0 || !currentVisitDate) return;

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  const dataCorrente = new Date(currentVisitDate).getTime();

  // Trova l'ultima visita salvata PRIMA della data corrente: funziona anche se la
  // data corrente è una bozza (un giorno senza ancora una visita salvata), caso in
  // cui la ricerca per corrispondenza esatta non trovava mai nulla
  const precedenti = visite.filter(v => new Date(soloData(v.data_visita)).getTime() < dataCorrente);
  if (precedenti.length === 0) return;

  const visitaPrecedente = precedenti[precedenti.length - 1];
  selectVisitaFromCalendar(soloData(visitaPrecedente.data_visita));
}

function navigateVisitaSuccessiva() {
  if (!currentPatient || cachedVisitsList.length === 0 || !currentVisitDate) return;

  const visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  const dataCorrente = new Date(currentVisitDate).getTime();

  const successive = visite.filter(v => new Date(soloData(v.data_visita)).getTime() > dataCorrente);
  if (successive.length === 0) return;

  const visitaSuccessiva = successive[0];
  selectVisitaFromCalendar(soloData(visitaSuccessiva.data_visita));
}

// Aggiorna il testo del pulsante di salvataggio ("Salva" / "Aggiorna") e la
// visibilità del pulsante di eliminazione, in base al fatto che la visita
// aperta esista già (currentVisitId) o sia ancora una bozza non salvata
function aggiornaStatoBottoniVisita() {
  const btnSalva = document.getElementById('btn-salva-visita');
  const btnElimina = document.getElementById('btn-elimina-visita');
  if (btnSalva) {
    btnSalva.innerHTML = currentVisitId
      ? '<span>🔄</span> Aggiorna Visita'
      : '<span>💾</span> Salva Visita nel Cloud';
  }
  if (btnElimina) {
    btnElimina.classList.toggle('hidden', !currentVisitId);
  }
}

// Elimina la visita attualmente aperta (solo se già salvata), previa conferma
// esplicita. Dopo l'eliminazione resta sulla stessa data, ora tornata vuota.
async function eliminaVisitaCorrente() {
  if (!currentPatient || !currentVisitId || !sbClient) return;

  const dataDaEliminare = currentVisitDate;
  const [anno, mese, giorno] = (dataDaEliminare || '').split('-');
  const confermato = confirm(`Eliminare la visita del ${giorno}/${mese}/${anno}?\n\nQuesta azione non è reversibile.`);
  if (!confermato) return;

  try {
    const { error } = await sbClient.from('visite').delete().eq('id', currentVisitId);
    if (error) throw error;

    await caricaStoricoVisite(currentPatient.id);
    currentVisitId = null;
    selectVisitaFromCalendar(dataDaEliminare); // resta sulla stessa data, ora vuota
    alert('🗑️ Visita eliminata.');
  } catch (err) {
    alert(err.message);
  }
}


// Calcola l'RMR per una singola visita (stessa formula già in uso nel grafico RMR+BMR)
function calcolaRMRVisita(visita, sesso) {
  if (!visita) return null;
  return sesso === 'M'
    ? (66.473 + 13.7516 * visita.peso + 5.0033 * visita.altezza - 6.755 * visita.eta)
    : (655.0955 + 9.5634 * visita.peso + 1.8496 * visita.altezza - 4.6756 * visita.eta);
}

// Calcola il BMR per una singola visita (stessa formula già in uso nel grafico RMR+BMR)
function calcolaBMRVisita(visita, sesso) {
  if (!visita) return null;
  return sesso === 'M'
    ? (10 * visita.peso + 6.25 * visita.altezza - 5 * visita.eta + 5)
    : (10 * visita.peso + 6.25 * visita.altezza - 5 * visita.eta - 161);
}

// Calcola la % di Massa Grassa per una singola visita (stessa formula già in uso nel grafico Composizione Corporea)
function calcolaMassaGrassaPercentualeVisita(visita, sesso) {
  if (!visita) return null;
  const eta = visita.eta || 30;
  // DONNA: protocollo Jackson & Pollock a 3 pliche (Tricipite, Soprailiaca, Coscia).
  // Addome e Sottoscapolare restano tra i campi rilevabili ma non entrano nel calcolo.
  const somma = sesso === 'M'
    ? (visita.p_pettorale||0)+(visita.p_ascellare||0)+(visita.p_addome||0)+(visita.p_soprailiaca||0)+(visita.p_tricipitale||0)+(visita.p_sottoscapolare||0)+(visita.p_coscia||0)
    : (visita.p_tricipitale||0)+(visita.p_soprailiaca||0)+(visita.p_coscia||0);
  if (somma <= 0) return null;
  const bd = sesso === 'M'
    ? 1.112 - (0.00043499 * somma) + (0.00000055 * somma * somma) - (0.00028826 * eta)
    : 1.0994921 - (0.0009929 * somma) + (0.0000023 * somma * somma) - (0.0001392 * eta);
  return (495 / bd) - 450;
}

// Restituisce lo storico completo delle visite del paziente, filtrato dall'inizio
// fino alla visita attualmente selezionata nel calendario (inclusa)
function ottieniStoricoFinoAVisitaSelezionata() {
  let visite = [...cachedVisitsList].sort((a, b) => new Date(a.data_visita) - new Date(b.data_visita));
  if (currentVisitId) {
    const dataSelezionata = cachedVisitsList.find(x => x.id === currentVisitId);
    if (dataSelezionata) {
      visite = visite.filter(v => new Date(v.data_visita).getTime() <= new Date(dataSelezionata.data_visita).getTime());
    }
  }
  return visite;
}

/* ══════════════════════════════════════════════════════════════════════════
   RIEPILOGO NARRATIVO AUTOMATICO — commenta in prosa i dati della tabella
   riepilogativa (Inizio → Fine, stessa convenzione: prima visita in assoluto
   → visita selezionata). Usato sia per popolare il box editabile a schermo
   sia (tramite quello stesso box) per il testo che finisce nel PDF.
══════════════════════════════════════════════════════════════════════════ */

// Soglie sotto le quali un dato si considera invariato e non viene commentato
// nel testo (il Peso non ha soglia: è sempre presente nel racconto)
const SOGLIA_RIEPILOGO_RMR_BMR = 20;        // kcal
const SOGLIA_RIEPILOGO_MASSA_GRASSA = 0.5;  // %
const SOGLIA_RIEPILOGO_PLICHE = 3;          // mm
const SOGLIA_RIEPILOGO_CIRCONFERENZE = 1;   // cm

// Trasforma un nominativo salvato tutto maiuscolo (es. "MORETTI ANDREA") in una
// forma leggibile in prosa (es. "Moretti Andrea"), per il testo narrativo
function capitalizzaNome(nominativo) {
  if (!nominativo) return '';
  const parole = nominativo.toLowerCase().split(' ').filter(Boolean);
  if (parole.length === 0) return '';
  // Convenzione "COGNOME NOME" già usata nel resto della dashboard (es. "MORETTI ANDREA"):
  // il nome di battesimo è l'ultima parola, così nel testo compare solo quello, senza cognome
  const primoNome = parole[parole.length - 1];
  return primoNome.charAt(0).toUpperCase() + primoNome.slice(1);
}

// Unisce un elenco di frasi nel formato italiano "A, B e C"
function formattaElencoItaliano(parti) {
  const valide = parti.filter(Boolean);
  if (valide.length === 0) return '';
  if (valide.length === 1) return valide[0];
  return valide.slice(0, -1).join(', ') + ' e ' + valide[valide.length - 1];
}

// Trova, tra un insieme di campi (pliche o circonferenze), quello con la variazione
// assoluta più marcata tra due visite — il "distretto" più significativo, che sia
// concorde o discordante rispetto al trend generale della sua categoria. Richiede
// che il dato sia presente (> 0) in entrambe le visite e che superi la soglia.
function trovaDistrettoPiuSignificativo(primaVisita, ultimaVisita, campi, nomiCampi, soglia) {
  let migliore = null;
  campi.forEach(campo => {
    const v0 = primaVisita[campo] || 0;
    const v1 = ultimaVisita[campo] || 0;
    if (v0 <= 0 || v1 <= 0) return;
    const delta = v1 - v0;
    if (Math.abs(delta) < soglia) return;
    if (!migliore || Math.abs(delta) > Math.abs(migliore.delta)) {
      migliore = { nome: nomiCampi[campo] || campo, delta };
    }
  });
  return migliore;
}

// Genera il testo di riepilogo narrativo. Con una sola visita produce il
// paragrafo di benvenuto/baseline (nessun calcolo di variazione); con due o
// più visite confronta la prima visita in assoluto con quella selezionata.
function generaTestoRiepilogoNarrativo(visiteComplete, sesso, nominativo) {
  if (!visiteComplete || visiteComplete.length === 0) return '';

  const nome = capitalizzaNome(nominativo);

  const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
  const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_coscia']; // Protocollo JP 3 pliche donna: usato SOLO per la somma pliche totali
  const plicheFields = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;
  // Elenco COMPLETO delle pliche rilevabili, usato solo per individuare il "distretto più
  // significativo" nella frase narrativa: qui la donna può spaziare anche su Addome e
  // Sottoscapolare, che restano esclusi solo dalla somma/percentuali di composizione corporea
  const plicheFieldsFemminaCompleto = ['p_tricipitale', 'p_soprailiaca', 'p_addome', 'p_coscia', 'p_sottoscapolare'];
  const plicheFieldsDistretto = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemminaCompleto;
  const nomiPliche = {
    p_pettorale: 'Pettorale', p_ascellare: 'Ascellare', p_addome: 'Addome',
    p_soprailiaca: 'Soprailiaca', p_tricipitale: 'Tricipite',
    p_sottoscapolare: 'Sottoscapolare', p_coscia: 'Coscia'
  };

  const circFieldsMaschio = ['c_torace', 'c_vita', 'c_fianchi', 'c_braccio_contratto', 'c_coscia'];
  const circFieldsFemmina = ['c_vita', 'c_fianchi', 'c_gluteo', 'c_braccio_contratto', 'c_coscia'];
  const circFields = sesso === 'M' ? circFieldsMaschio : circFieldsFemmina;
  const nomiCirc = {
    c_torace: 'Torace', c_vita: 'Vita', c_fianchi: 'Fianchi',
    c_gluteo: 'Gluteo', c_braccio_contratto: 'Braccio', c_coscia: 'Coscia'
  };

  // ─── CASO 1: PRIMA VISITA (baseline) — nessun calcolo, solo il punto di partenza ───
  if (visiteComplete.length === 1) {
    const v = visiteComplete[0];
    const parti = [];

    parti.push(`un peso di ${v.peso.toFixed(1)} kg`);

    const rmr = calcolaRMRVisita(v, sesso);
    if (rmr !== null && !isNaN(rmr)) parti.push(`un RMR (Metabolismo a Riposo) di ${Math.round(rmr)} kcal`);

    const bmr = calcolaBMRVisita(v, sesso);
    if (bmr !== null && !isNaN(bmr)) parti.push(`un BMR (Metabolismo Basale) di ${Math.round(bmr)} kcal`);

    const fm = calcolaMassaGrassaPercentualeVisita(v, sesso);
    if (fm !== null && !isNaN(fm)) {
      parti.push(`una massa grassa del ${fm.toFixed(1)}%`);
      parti.push(`una massa magra del ${(100 - fm).toFixed(1)}%`);
    }

    const sommaPliche = plicheFields.reduce((s, f) => s + (v[f] || 0), 0);
    if (sommaPliche > 0) parti.push(`una somma pliche di ${sommaPliche.toFixed(1)} mm`);

    const circonferenzePresenti = circFields.some(f => (v[f] || 0) > 0);
    if (circonferenzePresenti) parti.push('le prime misure di circonferenza');

    return `Questa è la prima visita registrata per ${nome}. Il punto di partenza vede ${formattaElencoItaliano(parti)}. Questi valori diventano il riferimento rispetto al quale misureremo i progressi nelle prossime visite.`;
  }

  // ─── CASO 2: VISITA DI CONFRONTO (prima visita in assoluto → visita selezionata) ───
  const primaVisita = visiteComplete[0];
  const ultimaVisita = visiteComplete[visiteComplete.length - 1];
  const frasi = [];

  // Peso: sempre presente, mai giudicato (un percorso può prevedere sia calo che aumento)
  const deltaPeso = ultimaVisita.peso - primaVisita.peso;
  if (Math.abs(deltaPeso) < 0.05) {
    frasi.push(`Il percorso di ${nome} mostra un peso stabile (${ultimaVisita.peso.toFixed(1)} kg)`);
  } else {
    const direzionePeso = deltaPeso < 0 ? 'una riduzione' : 'un aumento';
    frasi.push(`Il percorso di ${nome} mostra ${direzionePeso} di peso di ${Math.abs(deltaPeso).toFixed(1)} kg, passato da ${primaVisita.peso.toFixed(1)} a ${ultimaVisita.peso.toFixed(1)} kg`);
  }

  // RMR / BMR: solo fatto, nessun giudizio, solo se la variazione supera la soglia
  const rmr0 = calcolaRMRVisita(primaVisita, sesso);
  const rmr1 = calcolaRMRVisita(ultimaVisita, sesso);
  const bmr0 = calcolaBMRVisita(primaVisita, sesso);
  const bmr1 = calcolaBMRVisita(ultimaVisita, sesso);
  const rmrRilevante = rmr0 !== null && rmr1 !== null && !isNaN(rmr0) && !isNaN(rmr1) && Math.abs(rmr1 - rmr0) >= SOGLIA_RIEPILOGO_RMR_BMR;
  const bmrRilevante = bmr0 !== null && bmr1 !== null && !isNaN(bmr0) && !isNaN(bmr1) && Math.abs(bmr1 - bmr0) >= SOGLIA_RIEPILOGO_RMR_BMR;

  if (rmrRilevante && bmrRilevante) {
    frasi.push(`Il RMR (Metabolismo a Riposo) è passato da ${Math.round(rmr0)} a ${Math.round(rmr1)} kcal, mentre il BMR (Metabolismo Basale) da ${Math.round(bmr0)} a ${Math.round(bmr1)} kcal`);
  } else if (rmrRilevante) {
    frasi.push(`Il RMR (Metabolismo a Riposo) è passato da ${Math.round(rmr0)} a ${Math.round(rmr1)} kcal`);
  } else if (bmrRilevante) {
    frasi.push(`Il BMR (Metabolismo Basale) è passato da ${Math.round(bmr0)} a ${Math.round(bmr1)} kcal`);
  }

  // Massa Grassa / Magra: giudizio positivo/da monitorare in base al segno
  const fm0 = calcolaMassaGrassaPercentualeVisita(primaVisita, sesso);
  const fm1 = calcolaMassaGrassaPercentualeVisita(ultimaVisita, sesso);
  if (fm0 !== null && fm1 !== null && !isNaN(fm0) && !isNaN(fm1)) {
    const deltaFm = fm1 - fm0;
    if (Math.abs(deltaFm) >= SOGLIA_RIEPILOGO_MASSA_GRASSA) {
      const tono = deltaFm < 0 ? 'un dato positivo' : 'un dato da monitorare';
      const verboMagra = deltaFm < 0 ? 'sale' : 'scende';
      frasi.push(`La massa grassa passa dal ${fm0.toFixed(1)}% al ${fm1.toFixed(1)}% e la massa magra ${verboMagra} di pari passo — ${tono}`);
    }
  }

  // Somma Pliche (aggregata) + distretto più significativo
  const sommaPliche0 = plicheFields.reduce((s, f) => s + (primaVisita[f] || 0), 0);
  const sommaPliche1 = plicheFields.reduce((s, f) => s + (ultimaVisita[f] || 0), 0);
  const distrettoPliche = trovaDistrettoPiuSignificativo(primaVisita, ultimaVisita, plicheFieldsDistretto, nomiPliche, SOGLIA_RIEPILOGO_PLICHE);

  if (sommaPliche0 > 0 && sommaPliche1 > 0) {
    const deltaPliche = sommaPliche1 - sommaPliche0;
    if (Math.abs(deltaPliche) >= SOGLIA_RIEPILOGO_PLICHE) {
      const verbo = deltaPliche < 0 ? 'migliora' : 'aumenta';
      let frase = `Anche la somma delle pliche cutanee ${verbo}, con una variazione di ${Math.abs(deltaPliche).toFixed(1)} mm`;
      if (distrettoPliche) {
        frase += `, in particolare a livello ${distrettoPliche.nome} (${distrettoPliche.delta > 0 ? '+' : ''}${distrettoPliche.delta.toFixed(1)} mm)`;
      }
      frasi.push(frase);
    } else if (distrettoPliche) {
      const tono = distrettoPliche.delta < 0 ? 'un miglioramento localizzato' : 'un dato da monitorare';
      frasi.push(`Si segnala ${tono} a livello ${distrettoPliche.nome} (${distrettoPliche.delta > 0 ? '+' : ''}${distrettoPliche.delta.toFixed(1)} mm)`);
    }
  }

  // Circonferenze: solo il distretto più significativo (nessun aggregato, non esiste
  // una "somma circonferenze" nel resto della dashboard)
  const distrettoCirc = trovaDistrettoPiuSignificativo(primaVisita, ultimaVisita, circFields, nomiCirc, SOGLIA_RIEPILOGO_CIRCONFERENZE);
  if (distrettoCirc) {
    const verbo = distrettoCirc.delta < 0 ? 'si riduce' : 'aumenta';
    const tono = distrettoCirc.delta < 0 ? 'il dato più significativo tra le misure rilevate' : 'un dato da monitorare';
    frasi.push(`Tra le circonferenze, ${distrettoCirc.nome.toLowerCase()} ${verbo} di ${Math.abs(distrettoCirc.delta).toFixed(1)} cm — ${tono}`);
  }

  return frasi.join('. ') + '.';
}

/* 📊 LOGICA COSTRUZIONE GRAFICI DIVISI PER PAGINA */
function renderingGraficiElite(visiteComplete) {
  if (!visiteComplete || visiteComplete.length === 0) return;

  // Grafico principale: al massimo le ultime MAX_VISITE_GRAFICO visite, terminando
  // esattamente sulla visita selezionata (visiteComplete è già ordinato ed è già
  // filtrato fino alla visita selezionata da chi chiama questa funzione)
  const visite = visiteComplete.length > MAX_VISITE_GRAFICO
    ? visiteComplete.slice(-MAX_VISITE_GRAFICO)
    : visiteComplete;

  // Prima visita in assoluto e visita selezionata: servono per il trend
  // totalizzato mostrato nella Mini-Dashboard di ciascun grafico

  let labels = visite.map(v => new Date(v.data_visita).toLocaleDateString('it-IT'));
  const sesso = currentPatient.sesso;

  // Paziente alla prima visita: un solo punto dato. Per evitare che venga
  // schiacciato a sinistra sopra l'asse Y, lo centriamo aggiungendo due
  // etichette vuote di padding ai lati (e i relativi valori null nei dataset)
  const puntoSingoloCentrato = visite.length === 1;
  if (puntoSingoloCentrato) labels = ['', labels[0], ''];
  const centraPuntoSingolo = arr => puntoSingoloCentrato ? [null, arr[0], null] : arr;
  
  const configComune = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // Corridoio bianco dedicato a destra: qui vivono le etichette "a scalino"
      // dell'ultimo punto, senza attraversare mai le curve del grafico. Allargato
      // per dare più margine di manovra all'algoritmo anti-sovrapposizione quando
      // deve scartare più etichette lateralmente (es. grafici a 3 serie)
      padding: { right: 46 }
    },
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
      y: {
        grid: { color: 'rgba(200, 200, 200, 0.1)', drawBorder: false },
        // Aggiunge un respiro proporzionale in cima alla scala, cosi l'etichetta del
        // valore piu alto ha sempre spazio reale sopra di se, anche quando quel valore
        // e' gia vicino al massimo naturale dei dati (es. Massa Magra vicino al 90%)
        afterDataLimits: (scale) => {
          const range = scale.max - scale.min || 1;
          scale.max += range * 0.14;
        }
      }
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
        data: centraPuntoSingolo(pesoData),
        borderColor: COLORS.indigo,
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        fill: true,
        pointBorderColor: COLORS.indigo,
      }]
    },
    options: configComune
  });
  renderMiniDashboardRow('mini-peso', [
    { label: 'Peso', valori: visiteComplete.map(v => v.peso) }
  ], 'kg', 1, COLORS_MINI_DASH.metriche);

  // 2. RMR + BMR
  const rmrValues = visite.map(v => sesso === 'M' ? (66.473 + 13.7516 * v.peso + 5.0033 * v.altezza - 6.755 * v.eta) : (655.0955 + 9.5634 * v.peso + 1.8496 * v.altezza - 4.6756 * v.eta));
  const bmrValues = visite.map(v => sesso === 'M' ? (10 * v.peso + 6.25 * v.altezza - 5 * v.eta + 5) : (10 * v.peso + 6.25 * v.altezza - 5 * v.eta - 161));
  if (chartRmrBmr) chartRmrBmr.destroy();
  chartRmrBmr = new Chart(document.getElementById('chart-rmr-bmr').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'RMR (kcal)',
          data: centraPuntoSingolo(rmrValues),
          borderColor: COLORS.amber,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          fill: true,
          pointBorderColor: COLORS.amber,
        },
        {
          label: 'BMR (kcal)',
          data: centraPuntoSingolo(bmrValues),
          borderColor: COLORS.sky,
          backgroundColor: 'transparent',
          fill: false,
          pointBorderColor: COLORS.sky,
        }
      ]
    },
    options: configComune
  });
  renderMiniDashboardRow('mini-rmr-bmr', [
    { label: 'RMR', valori: visiteComplete.map(v => calcolaRMRVisita(v, sesso)) },
    { label: 'BMR', valori: visiteComplete.map(v => calcolaBMRVisita(v, sesso)) }
  ], 'kcal', 0, COLORS_MINI_DASH.metriche);

  // 3. % COMPOSIZIONE
  const fmData = [];
  const ffmData = [];
  visite.forEach(v => {
    const eta = v.eta || 30;
    // DONNA: protocollo Jackson & Pollock a 3 pliche (Tricipite, Soprailiaca, Coscia)
    let somma = sesso === 'M'
      ? (v.p_pettorale||0)+(v.p_ascellare||0)+(v.p_addome||0)+(v.p_soprailiaca||0)+(v.p_tricipitale||0)+(v.p_sottoscapolare||0)+(v.p_coscia||0)
      : (v.p_tricipitale||0)+(v.p_soprailiaca||0)+(v.p_coscia||0);
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
  if (chartComp) chartComp.destroy();
  chartComp = new Chart(document.getElementById('chart-composizione').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Massa Grassa %',
          data: centraPuntoSingolo(fmData),
          borderColor: COLORS.rose,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointBorderColor: COLORS.rose,
        },
        {
          label: 'Massa Magra %',
          data: centraPuntoSingolo(ffmData),
          borderColor: COLORS.emerald,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          pointBorderColor: COLORS.emerald,
        }
      ]
    },
    options: configComune
  });
  renderMiniDashboardRow('mini-composizione', [
    { label: 'Massa Grassa', valori: visiteComplete.map(v => calcolaMassaGrassaPercentualeVisita(v, sesso)) },
    { label: 'Massa Magra', valori: visiteComplete.map(v => {
      const fm = calcolaMassaGrassaPercentualeVisita(v, sesso);
      return fm !== null ? 100 - fm : null;
    }) }
  ], '%', 1, COLORS_MINI_DASH.metriche);

  // 4. KG MASSA
  const fmKgData = visite.map((v, i) => fmData[i] ? (v.peso * fmData[i]) / 100 : null);
  const ffmKgData = visite.map((v, i) => fmData[i] ? v.peso - fmKgData[i] : null);
  if (chartKgMassa) chartKgMassa.destroy();
  chartKgMassa = new Chart(document.getElementById('chart-kg-massa').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Kg Massa Grassa',
          data: centraPuntoSingolo(fmKgData),
          borderColor: COLORS.rose,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          fill: true,
          pointBorderColor: COLORS.rose,
        },
        {
          label: 'Kg Massa Magra',
          data: centraPuntoSingolo(ffmKgData),
          borderColor: COLORS.emerald,
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true,
          pointBorderColor: COLORS.emerald,
        }
      ]
    },
    options: configComune
  });
  renderMiniDashboardRow('mini-kg-massa', [
    { label: 'Kg Grasso', valori: visiteComplete.map(v => {
      const fm = calcolaMassaGrassaPercentualeVisita(v, sesso);
      return fm !== null ? (v.peso * fm) / 100 : null;
    }) },
    { label: 'Kg Magro', valori: visiteComplete.map(v => {
      const fm = calcolaMassaGrassaPercentualeVisita(v, sesso);
      return fm !== null ? v.peso - (v.peso * fm) / 100 : null;
    }) }
  ], 'kg', 1, COLORS_MINI_DASH.metriche);

  // ═══ PAGINA 2 - PLICHE ═══
  
  const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
  const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_coscia']; // Protocollo JP 3 pliche donna: Addome e Sottoscapolare esclusi dal calcolo
  const plicheFields = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;
  
  const sommaPliche = visite.map(v => plicheFields.reduce((sum, f) => sum + (v[f] || 0), 0));
  const calcolaSommaPlicheVisita = v => plicheFields.reduce((sum, f) => sum + (v[f] || 0), 0);

  // Somma Pliche
  if (chartSommaPliche) chartSommaPliche.destroy();
  chartSommaPliche = new Chart(document.getElementById('chart-somma-pliche').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Somma Pliche (mm)',
        data: centraPuntoSingolo(sommaPliche),
        borderColor: COLORS.amber,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        fill: true,
        pointBorderColor: COLORS.amber,
      }]
    },
    options: configComune
  });
  renderMiniDashboardRow('mini-somma-pliche', [
    { label: 'Somma Pliche', valori: visiteComplete.map(v => calcolaSommaPlicheVisita(v)) }
  ], 'mm', 1, COLORS_MINI_DASH.pliche);

  // Pliche Accoppiate per UOMO
  if (sesso === 'M') {
    const p_pettorale = visite.map(v => v.p_pettorale || 0);
    const p_ascellare = visite.map(v => v.p_ascellare || 0);
    const p_addome = visite.map(v => v.p_addome || 0);
    const p_soprailiaca = visite.map(v => v.p_soprailiaca || 0);
    const p_tricipitale = visite.map(v => v.p_tricipitale || 0);
    const p_sottoscapolare = visite.map(v => v.p_sottoscapolare || 0);
    const p_coscia = visite.map(v => v.p_coscia || 0);

    if (Chart.getChart('chart-pliche-1-uomo')) Chart.getChart('chart-pliche-1-uomo').destroy();
    new Chart(document.getElementById('chart-pliche-1-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Pettorale', data: centraPuntoSingolo(p_pettorale), borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Ascellare', data: centraPuntoSingolo(p_ascellare), borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-1-uomo', [
      { label: 'Pettorale', valori: visiteComplete.map(v => v.p_pettorale || 0) },
      { label: 'Ascellare', valori: visiteComplete.map(v => v.p_ascellare || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);

    if (Chart.getChart('chart-pliche-2-uomo')) Chart.getChart('chart-pliche-2-uomo').destroy();
    new Chart(document.getElementById('chart-pliche-2-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Addome', data: centraPuntoSingolo(p_addome), borderColor: COLORS.sky, backgroundColor: 'rgba(14, 165, 233, 0.08)', fill: true, pointBorderColor: COLORS.sky },
        { label: 'Soprailiaca', data: centraPuntoSingolo(p_soprailiaca), borderColor: COLORS.rose, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.rose }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-2-uomo', [
      { label: 'Addome', valori: visiteComplete.map(v => v.p_addome || 0) },
      { label: 'Soprailiaca', valori: visiteComplete.map(v => v.p_soprailiaca || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);

    if (Chart.getChart('chart-pliche-3-uomo')) Chart.getChart('chart-pliche-3-uomo').destroy();
    new Chart(document.getElementById('chart-pliche-3-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Tricipitale', data: centraPuntoSingolo(p_tricipitale), borderColor: COLORS.emerald, backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: true, pointBorderColor: COLORS.emerald },
        { label: 'Sottoscapolare', data: centraPuntoSingolo(p_sottoscapolare), borderColor: COLORS.amber, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.amber }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-3-uomo', [
      { label: 'Tricipitale', valori: visiteComplete.map(v => v.p_tricipitale || 0) },
      { label: 'Sottoscapolare', valori: visiteComplete.map(v => v.p_sottoscapolare || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);

    if (Chart.getChart('chart-pliche-4-uomo')) Chart.getChart('chart-pliche-4-uomo').destroy();
    new Chart(document.getElementById('chart-pliche-4-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Coscia', data: centraPuntoSingolo(p_coscia), borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-4-uomo', [
      { label: 'Coscia', valori: visiteComplete.map(v => v.p_coscia || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);
  } else {
    // Pliche Accoppiate per DONNA (stessa struttura dell'uomo, senza pettorale/ascellare)
    const p_tricipitale = visite.map(v => v.p_tricipitale || 0);
    const p_soprailiaca = visite.map(v => v.p_soprailiaca || 0);
    const p_addome = visite.map(v => v.p_addome || 0);
    const p_coscia = visite.map(v => v.p_coscia || 0);
    const p_sottoscapolare = visite.map(v => v.p_sottoscapolare || 0);

    if (Chart.getChart('chart-pliche-1-donna')) Chart.getChart('chart-pliche-1-donna').destroy();
    new Chart(document.getElementById('chart-pliche-1-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Addome', data: centraPuntoSingolo(p_addome), borderColor: COLORS.sky, backgroundColor: 'rgba(14, 165, 233, 0.08)', fill: true, pointBorderColor: COLORS.sky },
        { label: 'Soprailiaca', data: centraPuntoSingolo(p_soprailiaca), borderColor: COLORS.rose, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.rose }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-1-donna', [
      { label: 'Addome', valori: visiteComplete.map(v => v.p_addome || 0) },
      { label: 'Soprailiaca', valori: visiteComplete.map(v => v.p_soprailiaca || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);

    if (Chart.getChart('chart-pliche-2-donna')) Chart.getChart('chart-pliche-2-donna').destroy();
    new Chart(document.getElementById('chart-pliche-2-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Tricipitale', data: centraPuntoSingolo(p_tricipitale), borderColor: COLORS.emerald, backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: true, pointBorderColor: COLORS.emerald },
        { label: 'Sottoscapolare', data: centraPuntoSingolo(p_sottoscapolare), borderColor: COLORS.amber, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.amber }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-2-donna', [
      { label: 'Tricipitale', valori: visiteComplete.map(v => v.p_tricipitale || 0) },
      { label: 'Sottoscapolare', valori: visiteComplete.map(v => v.p_sottoscapolare || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);

    if (Chart.getChart('chart-pliche-3-donna')) Chart.getChart('chart-pliche-3-donna').destroy();
    new Chart(document.getElementById('chart-pliche-3-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Coscia', data: centraPuntoSingolo(p_coscia), borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-pliche-3-donna', [
      { label: 'Coscia', valori: visiteComplete.map(v => v.p_coscia || 0) }
    ], 'mm', 1, COLORS_MINI_DASH.pliche);
  }

  // ═══ PAGINA 3 - CIRCONFERENZE ═══
  
  const c_torace = visite.map(v => v.c_torace || 0);
  const c_vita = visite.map(v => v.c_vita || 0);
  const c_fianchi = visite.map(v => v.c_fianchi || 0);
  const c_gluteo = visite.map(v => v.c_gluteo || 0);
  const c_braccio = visite.map(v => v.c_braccio_contratto || 0);
  const c_coscia = visite.map(v => v.c_coscia || 0);

  if (sesso === 'M') {
    if (Chart.getChart('chart-circ-1-uomo')) Chart.getChart('chart-circ-1-uomo').destroy();
    new Chart(document.getElementById('chart-circ-1-uomo').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Torace', data: centraPuntoSingolo(c_torace), borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Vita', data: centraPuntoSingolo(c_vita), borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet },
        { label: 'Fianchi', data: centraPuntoSingolo(c_fianchi), borderColor: COLORS.sky, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.sky }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-circ-1-uomo', [
      { label: 'Torace', valori: visiteComplete.map(v => v.c_torace || 0) },
      { label: 'Vita', valori: visiteComplete.map(v => v.c_vita || 0) },
      { label: 'Fianchi', valori: visiteComplete.map(v => v.c_fianchi || 0) }
    ], 'cm', 1, COLORS_MINI_DASH.misure);
  } else {
    if (Chart.getChart('chart-circ-1-donna')) Chart.getChart('chart-circ-1-donna').destroy();
    new Chart(document.getElementById('chart-circ-1-donna').getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Vita', data: centraPuntoSingolo(c_vita), borderColor: COLORS.indigo, backgroundColor: 'rgba(79, 70, 229, 0.08)', fill: true, pointBorderColor: COLORS.indigo },
        { label: 'Fianchi', data: centraPuntoSingolo(c_fianchi), borderColor: COLORS.violet, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.violet },
        { label: 'Gluteo', data: centraPuntoSingolo(c_gluteo), borderColor: COLORS.sky, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.sky }
      ]},
      options: configComune
    });
    renderMiniDashboardRow('mini-circ-1-donna', [
      { label: 'Vita', valori: visiteComplete.map(v => v.c_vita || 0) },
      { label: 'Fianchi', valori: visiteComplete.map(v => v.c_fianchi || 0) },
      { label: 'Gluteo', valori: visiteComplete.map(v => v.c_gluteo || 0) }
    ], 'cm', 1, COLORS_MINI_DASH.misure);
  }

  if (Chart.getChart('chart-circ-braccio')) Chart.getChart('chart-circ-braccio').destroy();
  new Chart(document.getElementById('chart-circ-braccio').getContext('2d'), {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Braccio', data: centraPuntoSingolo(c_braccio), borderColor: COLORS.emerald, backgroundColor: 'rgba(16, 185, 129, 0.08)', fill: true, pointBorderColor: COLORS.emerald },
      { label: 'Coscia', data: centraPuntoSingolo(c_coscia), borderColor: COLORS.amber, backgroundColor: 'transparent', fill: false, pointBorderColor: COLORS.amber }
    ]},
    options: configComune
  });
  renderMiniDashboardRow('mini-circ-braccio', [
    { label: 'Braccio', valori: visiteComplete.map(v => v.c_braccio_contratto || 0) },
    { label: 'Coscia', valori: visiteComplete.map(v => v.c_coscia || 0) }
  ], 'cm', 1, COLORS_MINI_DASH.misure);

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

// Converte un colore esadecimale (#rrggbb) nei componenti RGB, usato dal
// disegno vettoriale della sparkline nel PDF (jsPDF lavora in RGB, non hex)
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 79, g: 70, b: 229 };
}

// Quanto "appiattire" le oscillazioni reali nella sparkline della Mini-Dashboard:
// 1 = proporzione reale dei dati, valori più bassi = linea più calma e quasi dritta
// (condiviso tra la versione a schermo e quella nel PDF, per restare coerenti)
const SPARKLINE_COMPRESSIONE = 0.4;

// Ammorbidisce una serie di valori con una media mobile leggera, per una linea più
// "calma" anche quando i dati reali oscillano spesso (es. pliche settimanali).
// Il primo e l'ultimo valore restano ancorati al dato reale (non vengono mediati),
// così la curva parte e finisce esattamente dove indicano le etichette numeriche;
// solo i punti intermedi vengono smussati. Condiviso tra schermo e PDF.
function smussaValori(valori, raggio = 1) {
  if (valori.length <= 2) return valori.slice();
  return valori.map((v, i) => {
    if (i === 0 || i === valori.length - 1) return v; // ancore fisse: inizio e fine reali
    let somma = 0, conteggio = 0;
    for (let k = -raggio; k <= raggio; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < valori.length) { somma += valori[idx]; conteggio++; }
    }
    return somma / conteggio;
  });
}

// Converte una sequenza di punti in un path SVG morbido (spline di Catmull-Rom
// convertita in curve di Bézier cubiche): niente spigoli tra un dato e l'altro.
// Con includiMoveTo=false restituisce solo i comandi "C", assumendo che il pennino
// sia già posizionato sul primo punto (usato per incatenare due curve in un'unica
// forma chiusa, es. la linea superiore e quella inferiore della fascia d'ombra).
function costruisciPathMorbido(punti, includiMoveTo = true) {
  if (punti.length < 2) return includiMoveTo && punti.length === 1 ? `M${punti[0].x.toFixed(1)},${punti[0].y.toFixed(1)}` : '';
  let path = includiMoveTo ? `M${punti[0].x.toFixed(1)},${punti[0].y.toFixed(1)}` : '';
  for (let i = 0; i < punti.length - 1; i++) {
    const p0 = punti[i - 1] || punti[i];
    const p1 = punti[i];
    const p2 = punti[i + 1];
    const p3 = punti[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

// Converte una sequenza di punti [x,y] in segmenti di curva morbida (Catmull-Rom
// → Bézier cubica) nel formato "delta" richiesto da jsPDF pdf.lines(): usato per
// disegnare la sparkline nel PDF con la stessa morbidezza della versione a schermo
function costruisciSegmentiBezierPdf(punti) {
  const segmenti = [];
  for (let i = 0; i < punti.length - 1; i++) {
    const p0 = punti[i - 1] || punti[i];
    const p1 = punti[i];
    const p2 = punti[i + 1];
    const p3 = punti[i + 2] || p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    segmenti.push([cp1x - p1[0], cp1y - p1[1], cp2x - p1[0], cp2y - p1[1], p2[0] - p1[0], p2[1] - p1[1]]);
  }
  return segmenti;
}

// Costruisce una piccola sparkline SVG: curva morbida, ammorbidita con una media
// mobile leggera (calma anche su dati "nervosi") e ampiezza compressa, con una
// fascia d'ombra a spessore costante che segue il contorno della linea a distanza
// fissa — stessa tecnica già usata (e approvata) nel PDF, non un'area piena né un
// gradiente incollato al bordo esatto della curva. I due pallini di inizio/fine
// sono elementi separati posizionati in percentuale (non dentro il viewBox della
// curva): il viewBox usa preserveAspectRatio="none" per riempire la card, il che
// stirerebbe un <circle> trasformandolo in un'ellisse — i pallini restano invece
// sempre perfettamente rotondi, identici a quelli nitidi già usati nel PDF.
// Usata dalla Mini-Dashboard di ogni grafico.
function costruisciSparklineSVG(valori, colore) {
  const dati = (valori || []).filter(v => v !== null && v !== undefined && !isNaN(v));
  if (dati.length === 0) return { svg: '', puntoIniziale: null, puntoFinale: null };

  const datiLisci = smussaValori(dati);

  const larghezza = 100;
  const larghezzaUtile = larghezza * 0.92; // margine destro riservato al numero di fine, nello stesso sistema di coordinate della curva
  const altezza = 34;
  const paddingY = 6;
  const alturaUtile = altezza - paddingY * 2;
  const min = Math.min(...datiLisci);
  const max = Math.max(...datiLisci);
  const range = max - min || 1;

  const punti = datiLisci.map((v, i) => {
    const normale = (v - min) / range;
    const normaleCompresso = 0.5 + (normale - 0.5) * SPARKLINE_COMPRESSIONE;
    return {
      x: datiLisci.length === 1 ? larghezza / 2 : (i / (datiLisci.length - 1)) * larghezzaUtile,
      y: paddingY + (1 - normaleCompresso) * alturaUtile
    };
  });

  const puntoInizialePx = punti[0];
  const puntoFinalePx = punti[punti.length - 1];
  const pathLinea = punti.length > 1 ? costruisciPathMorbido(punti) : '';

  let pathArea = '';
  if (punti.length > 1) {
    const alturaBanda = alturaUtile * 0.38;
    const puntiBassi = punti.map(p => ({ x: p.x, y: p.y + alturaBanda }));
    const angoloBassoDestro = puntiBassi[puntiBassi.length - 1];
    const pathBassoInverso = costruisciPathMorbido(puntiBassi.slice().reverse(), false);
    pathArea = `${pathLinea} L${angoloBassoDestro.x.toFixed(1)},${angoloBassoDestro.y.toFixed(1)} ${pathBassoInverso} Z`;
  }

  const puntoInizialePct = { x: (puntoInizialePx.x / larghezza * 100).toFixed(2), y: (puntoInizialePx.y / altezza * 100).toFixed(2) };
  const puntoFinalePct = { x: (puntoFinalePx.x / larghezza * 100).toFixed(2), y: (puntoFinalePx.y / altezza * 100).toFixed(2) };

  const svg = `
    <svg viewBox="0 0 ${larghezza} ${altezza}" preserveAspectRatio="none" class="mini-dash-spark-svg">
      ${pathArea ? `<path d="${pathArea}" fill="${colore}" fill-opacity="0.10" stroke="none"/>` : ''}
      ${pathLinea ? `<path d="${pathLinea}" fill="none" stroke="${colore}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    </svg>
    <span class="mini-dash-spark-dot mini-dash-spark-dot-start" style="left:${puntoInizialePct.x}%; top:${puntoInizialePct.y}%; background:${colore};"></span>
    <span class="mini-dash-spark-dot mini-dash-spark-dot-end" style="left:${puntoFinalePct.x}%; top:${puntoFinalePct.y}%; background:${colore};"></span>
  `;

  return { svg, puntoIniziale: dati[0], puntoFinale: dati[dati.length - 1] };
}

// Mini-Dashboard: trend totalizzato del paziente dall'inizio della sua storia fino
// alla visita selezionata. Per ogni serie del grafico (1, 2 o 3) disegna un blocco
// con nome della serie, pillola del delta complessivo e sparkline con i valori di
// inizio/fine ancorati ai relativi punti. I blocchi vengono affiancati in una fila
// uniforme (sostituisce il vecchio box Min/Max/Media/Variazione, che mostrava solo
// la prima serie: qui invece ogni serie del grafico ha il proprio riepilogo).
function renderMiniDashboardRow(containerId, serie, unit, decimals = 1, colore = '#4f46e5') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const unitaTxt = unit ? ` ${unit}` : '';

  const blocchi = (serie || []).map(s => {
    const { svg, puntoIniziale, puntoFinale } = costruisciSparklineSVG(s.valori, colore);
    if (!svg || puntoIniziale === null || puntoFinale === null) return '';

    const delta = puntoFinale - puntoIniziale;
    const segno = delta > 0 ? '+' : '';
    // La Massa Magra ha direzione invertita rispetto alle altre metriche: un
    // aumento è il segnale positivo (verde), non quello da monitorare (rosa)
    const direzioneInvertita = s.label === 'Massa Magra';
    const classe = delta > 0 ? (direzioneInvertita ? 'negativo' : 'positivo') : (delta < 0 ? (direzioneInvertita ? 'positivo' : 'negativo') : '');
    const freccia = delta > 0 ? '↑' : (delta < 0 ? '↓' : '→');

    return `
      <div class="mini-dash-item">
        <div class="mini-dash-top">
          <span class="mini-dash-dot" style="background:${colore}"></span>
          <span class="mini-dash-eyebrow">${s.label}</span>
          <span class="mini-dash-delta ${classe}">${freccia} ${segno}${delta.toFixed(decimals)}${unitaTxt}</span>
        </div>
        <div class="mini-dash-spark-wrap">
          ${svg}
          <span class="mini-dash-spark-start">${puntoIniziale.toFixed(decimals)}${unitaTxt}</span>
          <span class="mini-dash-spark-end" style="color:${colore}">${puntoFinale.toFixed(decimals)}${unitaTxt}</span>
        </div>
      </div>`;
  }).filter(Boolean);

  container.innerHTML = blocchi.length
    ? `<div class="mini-dash-row cols-${blocchi.length}">${blocchi.join('')}</div>`
    : '';
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
    const stavaGiaModificando = !!currentVisitId;
    let res = currentVisitId
      ? await sbClient.from('visite').update(payload).eq('id', currentVisitId).select()
      : await sbClient.from('visite').insert([payload]).select();
    if (res.error) throw res.error;
    
    if (!currentVisitId && res.data && res.data[0]) {
      currentVisitId = res.data[0].id;
    }
    
    alert(stavaGiaModificando ? '✅ Visita aggiornata con successo.' : '✅ Visita salvata con successo.');
    
    await caricaStoricoVisite(currentPatient.id);
    renderCalendar();
    aggiornaVisitCounter();
    aggiornaStatoBottoniVisita();
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
    applicaAltezzaFissa();
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

  // Filtra le visite dall'inizio della storia fino a quella selezionata nel calendario
  const vistePerGrafici = ottieniStoricoFinoAVisitaSelezionata();

  // Genera i grafici con i dati filtrati (il grafico principale mostrerà al massimo le ultime
  // MAX_VISITE_GRAFICO visite, terminando sulla visita selezionata; la Mini-Dashboard userà
  // invece l'intero storico filtrato per il trend totalizzato)
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

  // pk: elenco COMPLETO delle pliche rilevate/mostrate in tabella (invariato: i 5 campi
  // della donna restano tutti inseribili e visibili nel report, anche se non tutti entrano nel calcolo)
  const pk = sesso === 'M' ? ['Pettorale', 'Ascellare', 'Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'] : ['Addome', 'Soprailiaca', 'Tricipitale', 'Sottoscapolare', 'Coscia'];
  // pkCalcolo: pliche EFFETTIVAMENTE usate nella formula di composizione corporea.
  // Uomo: protocollo Jackson & Pollock a 7 pliche (invariato).
  // Donna: protocollo Jackson & Pollock a 3 pliche (Tricipite, Soprailiaca, Coscia) — Addome
  // e Sottoscapolare restano misurabili/visibili ma sono esclusi dal calcolo.
  const pkCalcolo = sesso === 'M' ? pk : ['Soprailiaca', 'Tricipitale', 'Coscia'];
  let sommaPliche = 0;
  let haPliche = false;
  pkCalcolo.forEach(p => {
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

  set('r-lbl-pliche', `Plicometria totale (${sesso === 'M' ? 7 : 3} pliche):`);
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
    <p>Metodo: ${sesso === 'M' ? 'Jackson & Pollock / 7 pliche' : 'Jackson & Pollock / 3 pliche'}</p>
    <p>Somma pliche (mm) = ${sommaPliche.toFixed(2).replace('.', ',')} mm</p>
  `;

  // Genera il testo di riepilogo narrativo automatico e lo mostra nel box editabile
  // a schermo, in fondo alla pagina. Nessun salvataggio: si ricalcola da zero ogni
  // volta che si apre/riapre la visita (il dottore può modificarlo prima di scaricare)
  document.getElementById('sezione-riepilogo-narrativo')?.classList.remove('hidden');
  document.getElementById('btn-scroll-to-bottom')?.classList.remove('hidden');
  const textareaRiepilogoNarrativo = document.getElementById('textarea-riepilogo-narrativo');
  if (textareaRiepilogoNarrativo) {
    textareaRiepilogoNarrativo.value = generaTestoRiepilogoNarrativo(vistePerGrafici, sesso, currentPatient.nominativo);
  }

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

// Esegue in sequenza i due download già esistenti (Composizione + Progressione,
// invariati), producendo due file PDF separati con un solo click
async function stampaTuttoReport() {
  const btn = document.getElementById('btn-stampa-tutto');
  const testoOriginale = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generazione in corso...'; }

  await scaricaPDFComposizione();
  await scaricaPDFProgressione();

  if (btn) { btn.disabled = false; btn.innerHTML = testoOriginale; }
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
  const wmWidth = 182;
  
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
  // LOGICA MEDICA: Uomo = Jackson & Pollock 7 pliche (invariato).
  // Donna = Jackson & Pollock 3 pliche (Tricipite, Soprailiaca, Coscia).
  if (sesso === 'M') {
    somma = (visita.p_pettorale || 0) + (visita.p_ascellare || 0) + (visita.p_addome || 0) + (visita.p_soprailiaca || 0) + (visita.p_tricipitale || 0) + (visita.p_sottoscapolare || 0) + (visita.p_coscia || 0);
    return 1.112 - (0.00043499 * somma) + (0.00000055 * Math.pow(somma, 2)) - (0.00028826 * visita.eta);
  } else {
    somma = (visita.p_tricipitale || 0) + (visita.p_soprailiaca || 0) + (visita.p_coscia || 0);
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
    // Storico completo del paziente, dall'inizio fino alla visita selezionata nel calendario
    // (stessa fonte dati usata per i grafici a schermo, così i due restano coerenti)
    const visite = ottieniStoricoFinoAVisitaSelezionata();
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

    // ─── MINI-DASHBOARD: trend totalizzato (prima visita storica → visita selezionata) ───
    const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
    const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_coscia']; // Protocollo JP 3 pliche donna: Addome e Sottoscapolare esclusi dal calcolo
    const plicheFieldsPdf = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;

    // Storico completo (array di valori, una voce per ogni serie del grafico) per ciascun
    // grafico: stessa impostazione della Mini-Dashboard a schermo, con lo stesso colore di
    // categoria (Metriche/Pliche/Misure). I grafici con 2-3 serie avranno 2-3 colonne nel PDF.
    const datiMiniDashboard = {
      'chart-peso': {
        unit: 'kg', decimals: 1, colore: COLORS_MINI_DASH.metriche,
        serie: [{ label: 'Peso', valori: visite.map(v => v.peso) }]
      },
      'chart-rmr-bmr': {
        unit: 'kcal', decimals: 0, colore: COLORS_MINI_DASH.metriche,
        serie: [
          { label: 'RMR', valori: visite.map(v => calcolaRMRVisita(v, sesso)) },
          { label: 'BMR', valori: visite.map(v => calcolaBMRVisita(v, sesso)) }
        ]
      },
      'chart-composizione': {
        unit: '%', decimals: 1, colore: COLORS_MINI_DASH.metriche,
        serie: [
          { label: 'Massa Grassa', valori: visite.map(v => calcolaMassaGrassaPercentualeVisita(v, sesso)) },
          { label: 'Massa Magra', valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? 100 - fm : null; }) }
        ]
      },
      'chart-kg-massa': {
        unit: 'kg', decimals: 1, colore: COLORS_MINI_DASH.metriche,
        serie: [
          { label: 'Kg Grasso', valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? (v.peso * fm) / 100 : null; }) },
          { label: 'Kg Magro', valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? v.peso - (v.peso * fm) / 100 : null; }) }
        ]
      },
      'chart-somma-pliche': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [{ label: 'Somma Pliche', valori: visite.map(v => plicheFieldsPdf.reduce((s, f) => s + (v[f] || 0), 0)) }]
      },
      'chart-pliche-1-uomo': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [
          { label: 'Pettorale', valori: visite.map(v => v.p_pettorale || 0) },
          { label: 'Ascellare', valori: visite.map(v => v.p_ascellare || 0) }
        ]
      },
      'chart-pliche-2-uomo': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [
          { label: 'Addome', valori: visite.map(v => v.p_addome || 0) },
          { label: 'Soprailiaca', valori: visite.map(v => v.p_soprailiaca || 0) }
        ]
      },
      'chart-pliche-3-uomo': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [
          { label: 'Tricipitale', valori: visite.map(v => v.p_tricipitale || 0) },
          { label: 'Sottoscapolare', valori: visite.map(v => v.p_sottoscapolare || 0) }
        ]
      },
      'chart-pliche-4-uomo': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [{ label: 'Coscia', valori: visite.map(v => v.p_coscia || 0) }]
      },
      'chart-pliche-1-donna': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [
          { label: 'Addome', valori: visite.map(v => v.p_addome || 0) },
          { label: 'Soprailiaca', valori: visite.map(v => v.p_soprailiaca || 0) }
        ]
      },
      'chart-pliche-2-donna': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [
          { label: 'Tricipitale', valori: visite.map(v => v.p_tricipitale || 0) },
          { label: 'Sottoscapolare', valori: visite.map(v => v.p_sottoscapolare || 0) }
        ]
      },
      'chart-pliche-3-donna': {
        unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche,
        serie: [{ label: 'Coscia', valori: visite.map(v => v.p_coscia || 0) }]
      },
      'chart-circ-1-uomo': {
        unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure,
        serie: [
          { label: 'Torace', valori: visite.map(v => v.c_torace || 0) },
          { label: 'Vita', valori: visite.map(v => v.c_vita || 0) },
          { label: 'Fianchi', valori: visite.map(v => v.c_fianchi || 0) }
        ]
      },
      'chart-circ-1-donna': {
        unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure,
        serie: [
          { label: 'Vita', valori: visite.map(v => v.c_vita || 0) },
          { label: 'Fianchi', valori: visite.map(v => v.c_fianchi || 0) },
          { label: 'Gluteo', valori: visite.map(v => v.c_gluteo || 0) }
        ]
      },
      'chart-circ-braccio': {
        unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure,
        serie: [
          { label: 'Braccio', valori: visite.map(v => v.c_braccio_contratto || 0) },
          { label: 'Coscia', valori: visite.map(v => v.c_coscia || 0) }
        ]
      },
    };

    // Disegna UNA serie (pallino + etichetta, pillola Δ, sparkline con valori inizio/fine
    // ancorati ai punti) dentro una colonna di larghezza "width" a partire da x,y
    const disegnaSerieMiniDashboard = (x, y, width, serieSingola, unit, decimals, colore) => {
      const valoriValidi = (serieSingola.valori || []).filter(v => v !== null && v !== undefined && !isNaN(v));
      if (valoriValidi.length === 0) return;

      const xDestro = x + width - 0.8; // piccolo margine per non far toccare i numeri al bordo della colonna
      const valoreIniziale = valoriValidi[0];
      const valoreFinale = valoriValidi[valoriValidi.length - 1];
      const delta = valoreFinale - valoreIniziale;
      const segno = delta > 0 ? '+' : '';
      const unitaTxt = unit ? ` ${unit}` : '';
      const testoIniziale = `${valoreIniziale.toFixed(decimals)}${unitaTxt}`;
      const testoFinale = `${valoreFinale.toFixed(decimals)}${unitaTxt}`;
      // Niente freccia Unicode: i font standard di jsPDF non la supportano e la mostrano
      // come "!" — il segno +/- e il colore bastano a comunicare la direzione
      const testoDelta = `${segno}${delta.toFixed(decimals)}${unitaTxt}`;
      // La Massa Magra ha direzione invertita rispetto alle altre metriche: un
      // aumento è il segnale positivo (verde), non quello da monitorare (rosa)
      const direzioneInvertita = serieSingola.label === 'Massa Magra';
      const deltaPositivo = direzioneInvertita ? delta < 0 : delta > 0;
      const deltaNegativo = direzioneInvertita ? delta > 0 : delta < 0;
      const coloreDelta = deltaPositivo ? [225, 29, 72] : (deltaNegativo ? [5, 150, 105] : [100, 116, 139]);
      const sfondoDelta = deltaPositivo ? [253, 237, 240] : (deltaNegativo ? [230, 247, 241] : [241, 245, 249]);
      const rgb = hexToRgb(colore);

      // Pillola del delta: disegnata per prima, così ne conosco la larghezza esatta
      // e posso riservare all'etichetta solo lo spazio che resta libero a sinistra
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'bold');
      const larghezzaTestoDelta = pdf.getTextWidth(testoDelta);
      const pillPaddingX = 1.3;
      const pillWidth = larghezzaTestoDelta + pillPaddingX * 2;
      const pillHeight = 3.2;
      const pillX = xDestro - pillWidth;
      const pillY = y - 0.3;

      pdf.setFillColor(sfondoDelta[0], sfondoDelta[1], sfondoDelta[2]);
      pdf.roundedRect(pillX, pillY, pillWidth, pillHeight, 1.1, 1.1, 'F');
      pdf.setTextColor(coloreDelta[0], coloreDelta[1], coloreDelta[2]);
      pdf.text(testoDelta, xDestro - pillPaddingX, y + 1.5, { align: 'right' });

      // Riga superiore: pallino + nome della serie a sinistra, per tutto lo spazio
      // rimasto libero prima della pillola del delta (mai sovrapposti)
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.circle(x + 1, y + 1.1, 0.55, 'F');
      pdf.setFontSize(5.2);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(148, 163, 184);
      pdf.text(serieSingola.label.toUpperCase(), x + 2.4, y + 1.5, { maxWidth: Math.max(pillX - x - 2.4 - 1.5, 4) });

      // Valore finale, in grassetto, sopra la sparkline (come "21.0" nel riferimento)
      pdf.setFontSize(6.2);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      pdf.text(testoFinale, xDestro, y + 4.3, { align: 'right' });

      // Sparkline: curva morbida (Catmull-Rom → Bézier), ammorbidita con la stessa media
      // mobile della versione a schermo, con ampiezza compressa (SPARKLINE_COMPRESSIONE
      // condivisa) + fascia leggera che segue la linea. Il tracciato si ferma un po' prima
      // del bordo destro della colonna (stesso margine riservato usato a schermo), per non
      // far toccare l'ultimo punto al numero di fine.
      const datiLisci = smussaValori(valoriValidi);
      const larghezzaUtile = width * 0.92;
      const sparkY = y + 5;
      const sparkHeight = 7.5;
      const min = Math.min(...datiLisci);
      const max = Math.max(...datiLisci);
      const range = max - min || 1;
      const punti = datiLisci.map((v, i) => {
        const normale = (v - min) / range;
        const normaleCompresso = 0.5 + (normale - 0.5) * SPARKLINE_COMPRESSIONE;
        return [
          datiLisci.length === 1 ? x + width / 2 : x + (i / (datiLisci.length - 1)) * larghezzaUtile,
          sparkY + sparkHeight - normaleCompresso * sparkHeight
        ];
      });

      if (punti.length > 1) {
        // Fascia leggera che segue il contorno della curva (non un'area piena fino alla base)
        const bandaOffset = sparkHeight * 0.38;
        const puntiBanda = punti.map(p => [p[0], p[1] + bandaOffset]);
        pdf.setGState(new window.jspdf.GState({ opacity: 0.10 }));
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        const poligono = [...punti, ...puntiBanda.slice().reverse()];
        const deltaPunti = poligono.slice(1).map((p, i) => [p[0] - poligono[i][0], p[1] - poligono[i][1]]);
        pdf.lines(deltaPunti, poligono[0][0], poligono[0][1], [1, 1], 'F', true);
        pdf.setGState(new window.jspdf.GState({ opacity: 1 }));

        // Linea morbida
        pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
        pdf.setLineWidth(0.35);
        const segmentiMorbidi = costruisciSegmentiBezierPdf(punti);
        pdf.lines(segmentiMorbidi, punti[0][0], punti[0][1], [1, 1], 'S', false);
      }

      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.circle(punti[0][0], punti[0][1], 0.45, 'F');
      pdf.circle(punti[punti.length - 1][0], punti[punti.length - 1][1], 0.55, 'F');

      // Valore iniziale, piccolo e neutro, ancorato al primo punto della sparkline
      pdf.setFontSize(5.2);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(testoIniziale, punti[0][0], sparkY + sparkHeight + 3, { align: 'left' });

      pdf.setTextColor(0, 0, 0);
    };

    // Disegna la Mini-Dashboard di un grafico: una colonna per ogni sua serie (1, 2 o 3),
    // affiancate in una fila uniforme che occupa la stessa larghezza del box del grafico
    // (sostituisce il vecchio riepilogo a singola metrica)
    const aggiuntaMiniDashboardBox = (x, y, width, dati) => {
      if (!dati || !dati.serie || dati.serie.length === 0) return;
      const numColonne = dati.serie.length;
      const gapColonne = 3;
      const larghezzaColonna = (width - gapColonne * (numColonne - 1)) / numColonne;

      dati.serie.forEach((serieSingola, i) => {
        const xColonna = x + i * (larghezzaColonna + gapColonne);
        disegnaSerieMiniDashboard(xColonna, y, larghezzaColonna, serieSingola, dati.unit, dati.decimals, dati.colore);
      });
    };
    
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
          // Sfondo violaceo (semi-trasparente: lascia intravedere la filigrana sotto)
          pdf.setGState(new window.jspdf.GState({ opacity: 0.6 }));
          pdf.setFillColor(bgViolet[0], bgViolet[1], bgViolet[2]);
          pdf.rect(x - padding, y - padding, width + (padding * 2), height + (padding * 2), 'F');
          pdf.setGState(new window.jspdf.GState({ opacity: 1 }));
          
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
    const miniDashHeight = 17; // spazio riservato alla Mini-Dashboard (con sparkline) sotto ogni grafico

    // ═══════════════════════════════════════════════════════════════════
    // PAGINA 1: METRICHE CORPOREE - 2x2 Grid
    // ═══════════════════════════════════════════════════════════════════
    
    let currentY = 113;
    
    currentY = renderSectionTitle('ANALISI DEI PARAMETRI CORPOREI', currentY);
    currentY += 8;

    // Grid 2x2: Peso, RMR+BMR, Composizione, Kg Massa
    const page1Charts = ['chart-peso', 'chart-rmr-bmr', 'chart-composizione', 'chart-kg-massa'];
    let gridY = currentY;
    let gridX = marginL;

    for (let i = 0; i < page1Charts.length; i++) {
      const chartId = page1Charts[i];
      const canvasEl = document.getElementById(chartId);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);
      aggiuntaMiniDashboardBox(gridX, gridY + miniChartHeight + 4, miniChartWidth, datiMiniDashboard[chartId]);

      // Layout 2x2: posizionamento
      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + miniDashHeight + gap + 4; // +4 per spazio tra righe
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
        // Sfondo violaceo full width (semi-trasparente: lascia intravedere la filigrana sotto)
        pdf.setGState(new window.jspdf.GState({ opacity: 0.6 }));
        pdf.setFillColor(bgViolet[0], bgViolet[1], bgViolet[2]);
        pdf.rect(marginL - padding, currentY - padding, contentWidth + (padding * 2), sommaHeight + (padding * 2), 'F');
        pdf.setGState(new window.jspdf.GState({ opacity: 1 }));
        
        const imgData = canvasSomma.toDataURL('image/png');
        if (imgData && imgData.length > 0) {
          pdf.addImage(imgData, 'PNG', marginL, currentY, contentWidth, sommaHeight);
          aggiuntaMiniDashboardBox(marginL, currentY + sommaHeight + 4, contentWidth, datiMiniDashboard['chart-somma-pliche']);
          currentY += sommaHeight + 15 + miniDashHeight;
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
      const chartId = plicheChartIds[i];
      const canvasEl = document.getElementById(chartId);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);
      aggiuntaMiniDashboardBox(gridX, gridY + miniChartHeight + 4, miniChartWidth, datiMiniDashboard[chartId]);

      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + miniDashHeight + gap + 4;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PAGINA 3: CIRCONFERENZE - 2x2 Grid
    // ═══════════════════════════════════════════════════════════════════

    pdf.addPage();
    await aggiungiWatermark(pdf);
    currentY = marginT;

    currentY = renderSectionTitle('ANALISI CIRCONFERENZE', currentY);
    currentY += 8;

    // Grid 2x2: Circonferenze sesso + Braccio
    const circChartIds = sesso === 'M'
      ? ['chart-circ-1-uomo', 'chart-circ-braccio']
      : ['chart-circ-1-donna', 'chart-circ-braccio'];

    gridY = currentY;
    gridX = marginL;

    for (let i = 0; i < circChartIds.length; i++) {
      const chartId = circChartIds[i];
      const canvasEl = document.getElementById(chartId);
      addChartWithBackground(canvasEl, gridX, gridY, miniChartWidth, miniChartHeight);
      aggiuntaMiniDashboardBox(gridX, gridY + miniChartHeight + 4, miniChartWidth, datiMiniDashboard[chartId]);

      if (i % 2 === 0) {
        gridX = marginL + miniChartWidth + gap;
      } else {
        gridX = marginL;
        gridY += miniChartHeight + miniDashHeight + gap + 4;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // RIEPILOGO COMPLESSIVO: tabella Inizio/Fine/Variazione + testo narrativo,
    // nello spazio residuo della pagina 3. Il testo viene letto dal box
    // editabile a schermo (già popolato all'apertura della visita), così le
    // eventuali modifiche manuali del dottore finiscono nel PDF.
    // ═══════════════════════════════════════════════════════════════════

    // Barra sfumata indigo→violet (stessa tecnica delle sparkline: tante strisce
    // sottili interpolate, perché jsPDF non ha gradienti nativi)
    const disegnaBarraGradienteRiepilogo = (x, y, width, height, colore1, colore2, orientamento) => {
      const passi = 30;
      for (let i = 0; i < passi; i++) {
        const t = i / (passi - 1);
        const r = Math.round(colore1[0] + (colore2[0] - colore1[0]) * t);
        const g = Math.round(colore1[1] + (colore2[1] - colore1[1]) * t);
        const b = Math.round(colore1[2] + (colore2[2] - colore1[2]) * t);
        pdf.setFillColor(r, g, b);
        if (orientamento === 'orizzontale') {
          const stepWidth = width / passi;
          pdf.rect(x + i * stepWidth, y, stepWidth + 0.2, height, 'F');
        } else {
          const stepHeight = height / passi;
          pdf.rect(x, y + i * stepHeight, width, stepHeight + 0.2, 'F');
        }
      }
    };

    // Tabella riepilogativa: card unica stondata, intestazione con tinta leggera,
    // righe separate da divisori sottili, variazione come pillola colorata
    const aggiungiTabellaRiepilogoCompleto = (x, y, width, righe) => {
      const raggio = 3;
      const rigaAltezza = 7;
      const headerAltezza = 8;
      const colLabel = width * 0.36;
      const colValore = width * 0.20;
      const altezzaTotale = headerAltezza + righe.length * rigaAltezza;

      // Sfondo della card semi-trasparente (stessa tecnica dei box viola dei grafici),
      // per lasciare intravedere la filigrana sotto
      pdf.setGState(new window.jspdf.GState({ opacity: 0.6 }));
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(x, y, width, altezzaTotale, raggio, raggio, 'F');

      let cursore = y;

      const coloreHeaderBg = [240, 238, 252];
      pdf.setFillColor(coloreHeaderBg[0], coloreHeaderBg[1], coloreHeaderBg[2]);
      pdf.roundedRect(x, y, width, headerAltezza + raggio, raggio, raggio, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.rect(x, y + headerAltezza, width, raggio, 'F');
      pdf.setGState(new window.jspdf.GState({ opacity: 1 }));

      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(67, 56, 202);
      pdf.text('METRICA', x + 6, cursore + headerAltezza - 2.6);
      pdf.text('INIZIO', x + colLabel, cursore + headerAltezza - 2.6);
      pdf.text('FINE', x + colLabel + colValore, cursore + headerAltezza - 2.6);
      pdf.text('VARIAZIONE', x + colLabel + colValore * 2, cursore + headerAltezza - 2.6);
      cursore += headerAltezza;

      pdf.setDrawColor(226, 220, 248);
      pdf.setLineWidth(0.2);
      pdf.line(x + 4, cursore, x + width - 4, cursore);

      righe.forEach((r, i) => {
        const centroRiga = cursore + rigaAltezza / 2;
        const rgbCategoria = hexToRgb(r.colore);

        pdf.setFillColor(rgbCategoria.r, rgbCategoria.g, rgbCategoria.b);
        pdf.circle(x + 3, centroRiga, 0.9, 'F');

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(r.label, x + 6.3, centroRiga + 1);

        const mancaIniziale = r.iniziale === null || r.iniziale === undefined || isNaN(r.iniziale) || r.iniziale === 0;
        const mancaFinale = r.finale === null || r.finale === undefined || isNaN(r.finale) || r.finale === 0;
        const testoIniziale = mancaIniziale ? '-' : `${r.iniziale.toFixed(r.decimals)} ${r.unit}`;
        const testoFinale = mancaFinale ? '-' : `${r.finale.toFixed(r.decimals)} ${r.unit}`;

        pdf.setTextColor(148, 163, 184);
        pdf.text(testoIniziale, x + colLabel, centroRiga + 1);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text(testoFinale, x + colLabel + colValore, centroRiga + 1);

        if (!mancaIniziale && !mancaFinale) {
          const delta = r.finale - r.iniziale;
          const segno = delta > 0 ? '+' : '';
          // La Massa Magra ha direzione invertita rispetto alle altre metriche: un
          // aumento è il segnale positivo (verde), non quello da monitorare (rosa)
          const direzioneInvertita = r.label === 'Massa Magra';
          const deltaPositivo = direzioneInvertita ? delta < 0 : delta > 0;
          const deltaNegativo = direzioneInvertita ? delta > 0 : delta < 0;
          const coloreDelta = deltaPositivo ? [225, 29, 72] : (deltaNegativo ? [5, 150, 105] : [100, 116, 139]);
          const sfondoDelta = deltaPositivo ? [253, 237, 240] : (deltaNegativo ? [230, 247, 241] : [241, 245, 249]);

          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'bold');
          const testoDelta = `${segno}${delta.toFixed(r.decimals)} ${r.unit}`;
          const larghezzaTesto = pdf.getTextWidth(testoDelta);
          const pillPaddingX = 1.6;
          const pillWidth = larghezzaTesto + pillPaddingX * 2;
          const pillX = x + colLabel + colValore * 2;
          const pillY = centroRiga - 2.1;

          pdf.setFillColor(sfondoDelta[0], sfondoDelta[1], sfondoDelta[2]);
          pdf.roundedRect(pillX, pillY, pillWidth, 4.2, 1.4, 1.4, 'F');
          pdf.setTextColor(coloreDelta[0], coloreDelta[1], coloreDelta[2]);
          pdf.text(testoDelta, pillX + pillPaddingX, centroRiga + 1);
        } else {
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(148, 163, 184);
          pdf.text('-', x + colLabel + colValore * 2, centroRiga + 1);
        }

        cursore += rigaAltezza;

        if (i < righe.length - 1) {
          pdf.setDrawColor(243, 244, 248);
          pdf.setLineWidth(0.15);
          pdf.line(x + 4, cursore, x + width - 4, cursore);
        }
      });

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(x, y, width, altezzaTotale, raggio, raggio, 'S');

      return y + altezzaTotale;
    };

    // Paragrafo narrativo: card stondata con barra sfumata laterale, testo sempre
    // centrato riga per riga, nome del paziente in grassetto (stesso stile già
    // approvato in pdf_prova.html)
    const aggiungiParagrafoRiepilogo = (x, y, width, paragrafi, nomePaziente) => {
      const raggio = 3;
      const barraLarghezza = 1.6;
      const paddingBox = 6;
      const dimensioneFont = 9;
      const interlinea = 4.8;
      const spazioTraParagrafi = 2.4;
      const centroX = x + width / 2;
      const larghezzaTesto = width - paddingBox * 2 - barraLarghezza;

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(dimensioneFont);
      const righePerParagrafo = paragrafi.map(p => pdf.splitTextToSize(p, larghezzaTesto));
      const numeroRigheTotali = righePerParagrafo.reduce((tot, righe) => tot + righe.length, 0);
      const altezzaBox = numeroRigheTotali * interlinea + (paragrafi.length - 1) * spazioTraParagrafi + paddingBox * 2 - 1;

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.25);
      pdf.setFillColor(250, 249, 255);
      pdf.roundedRect(x, y, width, altezzaBox, raggio, raggio, 'FD');

      const insetVerticale = raggio * 0.6;
      disegnaBarraGradienteRiepilogo(x + 1.3, y + insetVerticale, barraLarghezza, altezzaBox - insetVerticale * 2, [79, 70, 229], [168, 85, 247], 'verticale');

      let cursoreY = y + paddingBox + 2.5;
      pdf.setTextColor(51, 41, 100);

      righePerParagrafo.forEach((righe, idxParagrafo) => {
        righe.forEach((riga) => {
          const contieneNome = nomePaziente && riga.includes(nomePaziente);

          if (contieneNome) {
            const idx = riga.indexOf(nomePaziente);
            const pre = riga.slice(0, idx);
            const post = riga.slice(idx + nomePaziente.length);

            pdf.setFont('helvetica', 'italic');
            const larghezzaPre = pdf.getTextWidth(pre);
            pdf.setFont('helvetica', 'bolditalic');
            const larghezzaNome = pdf.getTextWidth(nomePaziente);
            pdf.setFont('helvetica', 'italic');
            const larghezzaPost = pdf.getTextWidth(post);
            const larghezzaRiga = larghezzaPre + larghezzaNome + larghezzaPost;

            let cursoreX = centroX - larghezzaRiga / 2;
            pdf.setFont('helvetica', 'italic');
            pdf.text(pre, cursoreX, cursoreY);
            cursoreX += larghezzaPre;
            pdf.setFont('helvetica', 'bolditalic');
            pdf.text(nomePaziente, cursoreX, cursoreY);
            cursoreX += larghezzaNome;
            pdf.setFont('helvetica', 'italic');
            pdf.text(post, cursoreX, cursoreY);
          } else {
            pdf.setFont('helvetica', 'italic');
            pdf.text(riga, centroX, cursoreY, { align: 'center' });
          }

          cursoreY += interlinea;
        });

        if (idxParagrafo < righePerParagrafo.length - 1) cursoreY += spazioTraParagrafi;
      });

      return y + altezzaBox;
    };

    // Righe della tabella: Metriche individuali + Somma Pliche aggregata +
    // Circonferenze individuali (stessa struttura approvata in pdf_prova.html)
    const chartIdsTabellaRiepilogo = [
      'chart-peso', 'chart-rmr-bmr', 'chart-composizione', 'chart-kg-massa',
      'chart-somma-pliche',
      ...(sesso === 'M' ? ['chart-circ-1-uomo'] : ['chart-circ-1-donna']),
      'chart-circ-braccio'
    ];

    // Solo per questa tabella: etichette estese di RMR/BMR (il nome breve resta
    // invariato ovunque altro, es. nelle mini-dashboard a schermo)
    const etichetteTabellaEstese = {
      'RMR': 'RMR (Metabolismo a Riposo)',
      'BMR': 'BMR (Metabolismo Basale)'
    };

    const righeTabellaRiepilogo = [];
    chartIdsTabellaRiepilogo.forEach(chartId => {
      const dati = datiMiniDashboard[chartId];
      if (!dati) return;
      dati.serie.forEach(s => {
        righeTabellaRiepilogo.push({
          label: etichetteTabellaEstese[s.label] || s.label,
          iniziale: s.valori[0],
          finale: s.valori[s.valori.length - 1],
          unit: dati.unit,
          decimals: dati.decimals,
          colore: dati.colore
        });
      });
    });

    let cursoreRiepilogo = gridY + 4 + 5; // +5mm (0,5cm) di respiro extra richiesto prima del titolo
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 58, 138);
    pdf.text('RIEPILOGO COMPLESSIVO', marginL, cursoreRiepilogo);
    cursoreRiepilogo += 6;

    cursoreRiepilogo = aggiungiTabellaRiepilogoCompleto(marginL, cursoreRiepilogo, contentWidth, righeTabellaRiepilogo);
    cursoreRiepilogo += 8;

    const testoRiepilogoNarrativo = document.getElementById('textarea-riepilogo-narrativo')?.value || '';
    if (testoRiepilogoNarrativo.trim()) {
      const nomePazienteGrassetto = capitalizzaNome(currentPatient?.nominativo);
      const paragrafiRiepilogo = testoRiepilogoNarrativo
        .split(/\n\s*\n/)
        .map(p => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (paragrafiRiepilogo.length > 0) {
        aggiungiParagrafoRiepilogo(marginL, cursoreRiepilogo, contentWidth, paragrafiRiepilogo, nomePazienteGrassetto);
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

/* ══════════════════════════════════════════════════════════════════════════════
   EXPORT SLIDE INSTAGRAM (BETA) — 3 immagini quadrate 1080×1080 pronte per il post,
   costruite catturando ad alta risoluzione le card già disegnate a schermo
   (html2canvas) e componendole su una tela nuova insieme a logo, titoli e alla
   tabella di riepilogo. Funzionalità indipendente: non tocca la generazione PDF
   già esistente (scaricaPDFComposizione / scaricaPDFProgressione / stampaTuttoReport).
══════════════════════════════════════════════════════════════════════════════ */

// Stesso violetto chiaro usato come sfondo nel PDF Progressione (bgViolet), per
// coerenza tra il file consegnato al paziente e le slide Instagram
const COLORE_VIOLETTO_PDF = 'rgb(240, 230, 250)';

// Cattura una card già visibile a schermo (identificata dall'id del SUO CANVAS, es.
// 'chart-peso') ad alta risoluzione. L'id passato è quello del solo <canvas>: titolo e
// mini-dashboard sono elementi "fratelli" nello stesso contenitore .chart-card, quindi
// si risale sempre al genitore prima di catturare, così l'immagine include tutta la card
// (titolo + mini-dashboard con lo storico completo + grafico) e non solo il grafico.
// Tinge temporaneamente lo sfondo della card (normalmente bianco) con lo stesso violetto
// del PDF, la cattura, poi ripristina subito lo sfondo originale: il sito a schermo non
// cambia mai aspetto, solo l'immagine esportata. Ritorna null (senza interrompere il
// resto) se la card non esiste o la cattura fallisce, così un singolo grafico mancante
// non blocca la generazione delle altre slide.
// Cattura il canvas di un grafico già visibile a schermo (identificato dal suo id) ad
// alta risoluzione. Tinge temporaneamente il suo sfondo (normalmente trasparente) con lo
// stesso violetto del PDF, la cattura, poi ripristina subito lo sfondo originale: il sito
// a schermo non cambia mai aspetto, solo l'immagine esportata. Cattura volutamente SOLO il
// canvas (non l'intera .chart-card): includere anche la mini-dashboard SVG rendeva la
// cattura instabile su sequenze lunghe. Il titolo e la mini-dashboard vengono invece
// ridisegnati a mano con Canvas 2D in scaricaSlideInstagram, molto più affidabile.
// Ritorna null (senza interrompere il resto) se il grafico non esiste o la cattura
// fallisce, così un singolo grafico mancante non blocca la generazione delle altre slide.
async function catturaCardInstagram(elementId, scale = 3) {
  const el = document.getElementById(elementId);
  if (!el) return null;
  const sfondoOriginale = el.style.background;
  try {
    el.style.background = COLORE_VIOLETTO_PDF;
    return await html2canvas(el, { scale, useCORS: true, backgroundColor: COLORE_VIOLETTO_PDF, logging: false });
  } catch (err) {
    console.warn('Errore cattura card per Instagram:', elementId, err);
    return null;
  } finally {
    el.style.background = sfondoOriginale;
  }
}

// Libera subito la memoria di un canvas già usato (una volta incollato sulla slide finale
// non serve più): azzerarne le dimensioni ne rilascia il buffer immediatamente, invece di
// aspettare il garbage collector — riduce l'accumulo di memoria lungo tutta l'esportazione
function liberaCanvasIG(c) {
  if (c) { c.width = 0; c.height = 0; }
}

// Cattura un blocco HTML arbitrario (es. la tabella di riepilogo) renderizzandolo
// fuori schermo nel contenitore dedicato #ig-riepilogo-offscreen, così può essere
// fotografato con html2canvas esattamente come una card reale
async function catturaHTMLOffscreenInstagram(innerHTML, larghezzaPx, scale = 3) {
  const container = document.getElementById('ig-riepilogo-offscreen');
  if (!container) return null;
  container.style.width = larghezzaPx + 'px';
  container.innerHTML = innerHTML;
  try {
    return await html2canvas(container, { scale, useCORS: true, backgroundColor: null, logging: false });
  } catch (err) {
    console.warn('Errore cattura tabella riepilogo per Instagram:', err);
    return null;
  } finally {
    container.innerHTML = '';
  }
}

// Ricostruisce le righe Metrica/Inizio/Fine/Variazione (stessa lista e stessa
// logica di calcolo già usata per la tabella "Riepilogo Complessivo" nel PDF
// Progressione), indipendente dal codice del PDF per non rischiare di alterarlo
// Prepara le serie storiche COMPLETE (tutte le visite, stessa fonte dati e stesse formule
// usate a schermo in renderingGraficiElite) per ciascun grafico: servono per ridisegnare a
// mano la mini-dashboard con lo sparkline "totalizzato" sotto ogni card, al posto di
// fotografarla con html2canvas (che si è rivelato inaffidabile su sequenze lunghe)
function costruisciSerieComplete(visite, sesso) {
  const massaGrassaPct = visite.map(v => calcolaMassaGrassaPercentualeVisita(v, sesso));
  const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
  const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_coscia'];
  const plicheFields = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;

  return {
    peso: visite.map(v => v.peso),
    rmr: visite.map(v => calcolaRMRVisita(v, sesso)),
    bmr: visite.map(v => calcolaBMRVisita(v, sesso)),
    massaGrassaPct,
    massaMagraPct: massaGrassaPct.map(fm => fm !== null && fm !== undefined ? 100 - fm : null),
    kgGrasso: visite.map((v, i) => massaGrassaPct[i] ? (v.peso * massaGrassaPct[i]) / 100 : null),
    kgMagro: visite.map((v, i) => massaGrassaPct[i] ? v.peso - (v.peso * massaGrassaPct[i]) / 100 : null),
    sommaPliche: visite.map(v => plicheFields.reduce((s, f) => s + (v[f] || 0), 0)),
    pettorale: visite.map(v => v.p_pettorale || 0),
    ascellare: visite.map(v => v.p_ascellare || 0),
    addome: visite.map(v => v.p_addome || 0),
    soprailiaca: visite.map(v => v.p_soprailiaca || 0),
    tricipitale: visite.map(v => v.p_tricipitale || 0),
    sottoscapolare: visite.map(v => v.p_sottoscapolare || 0),
    plicaCoscia: visite.map(v => v.p_coscia || 0),
    torace: visite.map(v => v.c_torace || 0),
    vita: visite.map(v => v.c_vita || 0),
    fianchi: visite.map(v => v.c_fianchi || 0),
    gluteo: visite.map(v => v.c_gluteo || 0),
    braccio: visite.map(v => v.c_braccio_contratto || 0),
    circCoscia: visite.map(v => v.c_coscia || 0)
  };
}

function costruisciRigheRiepilogoCompleto(visite, sesso) {
  if (!visite || visite.length === 0) return [];

  const plicheFieldsMaschio = ['p_pettorale', 'p_ascellare', 'p_addome', 'p_soprailiaca', 'p_tricipitale', 'p_sottoscapolare', 'p_coscia'];
  const plicheFieldsFemmina = ['p_tricipitale', 'p_soprailiaca', 'p_coscia'];
  const plicheFields = sesso === 'M' ? plicheFieldsMaschio : plicheFieldsFemmina;

  const serie = [
    { label: 'Peso', unit: 'kg', decimals: 1, colore: COLORS_MINI_DASH.metriche, valori: visite.map(v => v.peso) },
    { label: 'RMR (Metabolismo a Riposo)', unit: 'kcal', decimals: 0, colore: COLORS_MINI_DASH.metriche, valori: visite.map(v => calcolaRMRVisita(v, sesso)) },
    { label: 'BMR (Metabolismo Basale)', unit: 'kcal', decimals: 0, colore: COLORS_MINI_DASH.metriche, valori: visite.map(v => calcolaBMRVisita(v, sesso)) },
    { label: 'Massa Grassa', unit: '%', decimals: 1, colore: COLORS_MINI_DASH.metriche, valori: visite.map(v => calcolaMassaGrassaPercentualeVisita(v, sesso)) },
    {
      label: 'Massa Magra', unit: '%', decimals: 1, colore: COLORS_MINI_DASH.metriche,
      valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? 100 - fm : null; })
    },
    {
      label: 'Kg Grasso', unit: 'kg', decimals: 1, colore: COLORS_MINI_DASH.metriche,
      valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? (v.peso * fm) / 100 : null; })
    },
    {
      label: 'Kg Magro', unit: 'kg', decimals: 1, colore: COLORS_MINI_DASH.metriche,
      valori: visite.map(v => { const fm = calcolaMassaGrassaPercentualeVisita(v, sesso); return fm !== null ? v.peso - (v.peso * fm) / 100 : null; })
    },
    { label: 'Somma Pliche', unit: 'mm', decimals: 1, colore: COLORS_MINI_DASH.pliche, valori: visite.map(v => plicheFields.reduce((s, f) => s + (v[f] || 0), 0)) },
    ...(sesso === 'M'
      ? [
          { label: 'Torace', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_torace) },
          { label: 'Vita', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_vita) },
          { label: 'Fianchi', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_fianchi) }
        ]
      : [
          { label: 'Vita', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_vita) },
          { label: 'Fianchi', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_fianchi) },
          { label: 'Gluteo', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_gluteo) }
        ]),
    { label: 'Braccio', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_braccio_contratto) },
    { label: 'Coscia', unit: 'cm', decimals: 1, colore: COLORS_MINI_DASH.misure, valori: visite.map(v => v.c_coscia) }
  ];

  return serie.map(s => {
    const valoriValidi = s.valori.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (valoriValidi.length === 0) return null;
    const iniziale = valoriValidi[0];
    const finale = valoriValidi[valoriValidi.length - 1];
    return { label: s.label, unit: s.unit, decimals: s.decimals, colore: s.colore, iniziale, finale, delta: finale - iniziale };
  }).filter(Boolean);
}

// Costruisce l'HTML della tabella "Riepilogo Complessivo" con lo stile del sito,
// SENZA il testo narrativo automatico (richiesta esplicita, per privacy)
function costruisciTabellaRiepilogoHTML(righe) {
  const righeHTML = righe.map(r => {
    const direzioneInvertita = r.label === 'Massa Magra'; // per la massa magra un aumento è il segnale positivo
    const positivo = direzioneInvertita ? r.delta < 0 : r.delta > 0;
    const negativo = direzioneInvertita ? r.delta > 0 : r.delta < 0;
    const coloreVar = positivo ? '#e11d48' : (negativo ? '#059669' : '#64748b');
    const segno = r.delta > 0 ? '+' : '';
    const unitaTxt = r.unit ? ` ${r.unit}` : '';
    return `
      <tr>
        <td style="padding:7px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;white-space:nowrap;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.colore};margin-right:10px;"></span>${r.label}
        </td>
        <td style="padding:7px 16px;border-bottom:1px solid #e2e8f0;text-align:center;color:#64748b;">${r.iniziale.toFixed(r.decimals)}${unitaTxt}</td>
        <td style="padding:7px 16px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#0f172a;">${r.finale.toFixed(r.decimals)}${unitaTxt}</td>
        <td style="padding:7px 16px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:${coloreVar};">${segno}${r.delta.toFixed(r.decimals)}${unitaTxt}</td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:rgba(255,255,255,0.6);padding:4px;">
      <table style="width:100%;border-collapse:collapse;font-size:17px;">
        <thead>
          <tr style="background:rgb(240,238,252);">
            <th style="padding:9px 16px;text-align:left;color:#475569;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Metrica</th>
            <th style="padding:9px 16px;text-align:center;color:#475569;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Inizio</th>
            <th style="padding:9px 16px;text-align:center;color:#475569;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Fine</th>
            <th style="padding:9px 16px;text-align:center;color:#475569;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;">Variazione</th>
          </tr>
        </thead>
        <tbody>${righeHTML}</tbody>
      </table>
    </div>`;
}

// Disegna un'immagine (canvas catturato) dentro un rettangolo, mantenendo le sue
// proporzioni originali (nessun taglio, nessuna deformazione) e centrandola sia in
// larghezza che in altezza nello spazio disponibile
function disegnaRettangoloArrotondatoIG(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Sparkline smussato con area sfumata sotto la linea: stesso principio della versione SVG
// a schermo (costruisciSparklineSVG in renderMiniDashboardRow), ma disegnato direttamente
// in Canvas 2D — niente html2canvas, quindi niente fragilità su catture ripetute
function disegnaSparklineIG(ctx, dati, x, y, w, h, colore) {
  if (dati.length === 0) return;
  if (dati.length === 1) {
    ctx.beginPath();
    ctx.fillStyle = colore;
    ctx.arc(x + w / 2, y + h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const min = Math.min(...dati);
  const max = Math.max(...dati);
  const range = max - min || 1;
  const punti = dati.map((v, i) => ({
    x: x + (i / (dati.length - 1)) * w,
    y: y + h - ((v - min) / range) * h
  }));

  const tracciaCurva = () => {
    ctx.moveTo(punti[0].x, punti[0].y);
    for (let i = 0; i < punti.length - 1; i++) {
      const mx = (punti[i].x + punti[i + 1].x) / 2;
      const my = (punti[i].y + punti[i + 1].y) / 2;
      ctx.quadraticCurveTo(punti[i].x, punti[i].y, mx, my);
    }
    ctx.lineTo(punti[punti.length - 1].x, punti[punti.length - 1].y);
  };

  // Area sfumata sotto la linea
  ctx.beginPath();
  tracciaCurva();
  ctx.lineTo(punti[punti.length - 1].x, y + h);
  ctx.lineTo(punti[0].x, y + h);
  ctx.closePath();
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = colore;
  ctx.fill();
  ctx.restore();

  // Linea
  ctx.beginPath();
  tracciaCurva();
  ctx.strokeStyle = colore;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Puntini di inizio e fine
  [punti[0], punti[punti.length - 1]].forEach(p => {
    ctx.beginPath();
    ctx.fillStyle = colore;
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// Disegna a mano la mini-dashboard di un grafico (1-3 serie affiancate): pallino colorato
// + etichetta + pillola con il delta totale nella riga in alto, sparkline con i valori di
// inizio/fine ancorati sotto — stessi dati e stesso stile della mini-dashboard a schermo,
// riprodotti in Canvas 2D. Ritorna l'altezza occupata, per impilarci sotto il grafico.
function disegnaMiniDashboardIG(ctx, x, y, larghezza, serieList, unit, decimals, colore) {
  const serieValide = serieList.filter(s => (s.valori || []).some(v => v !== null && v !== undefined && !isNaN(v)));
  const n = serieValide.length;
  const altezzaBlocco = 88;
  if (n === 0) return 0;

  const gap = 14;
  const colW = (larghezza - gap * (n - 1)) / n;
  const unitaTxt = unit ? ` ${unit}` : '';

  serieValide.forEach((s, i) => {
    const colX = x + i * (colW + gap);
    const dati = s.valori.filter(v => v !== null && v !== undefined && !isNaN(v));
    const iniziale = dati[0];
    const finale = dati[dati.length - 1];
    const delta = finale - iniziale;
    const direzioneInvertita = s.label === 'Massa Magra';
    const positivo = direzioneInvertita ? delta < 0 : delta > 0;
    const negativo = direzioneInvertita ? delta > 0 : delta < 0;
    const coloreDelta = positivo ? '#e11d48' : (negativo ? '#059669' : '#64748b');
    const freccia = delta > 0 ? '↑' : (delta < 0 ? '↓' : '→');
    const segno = delta > 0 ? '+' : '';

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    disegnaRettangoloArrotondatoIG(ctx, colX, y, colW, altezzaBlocco, 12);
    ctx.fill();
    ctx.restore();

    const padX = 14;

    ctx.beginPath();
    ctx.fillStyle = colore;
    ctx.arc(colX + padX + 4, y + 19, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#64748b';
    ctx.font = "700 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label.toUpperCase(), colX + padX + 14, y + 19);

    const testoDelta = `${freccia} ${segno}${delta.toFixed(decimals)}${unitaTxt}`;
    const largDelta = ctx.measureText(testoDelta).width + 18;
    const deltaX = Math.max(colX + padX + 90, colX + colW - padX - largDelta);
    ctx.fillStyle = positivo ? 'rgba(225,29,72,0.12)' : (negativo ? 'rgba(5,150,105,0.12)' : 'rgba(100,116,139,0.12)');
    disegnaRettangoloArrotondatoIG(ctx, deltaX, y + 8, largDelta, 22, 11);
    ctx.fill();
    ctx.fillStyle = coloreDelta;
    ctx.textAlign = 'center';
    ctx.fillText(testoDelta, deltaX + largDelta / 2, y + 19);

    const sparkY = y + 40;
    const sparkH = 28;
    const sparkX = colX + padX;
    const sparkW = colW - padX * 2;
    disegnaSparklineIG(ctx, dati, sparkX, sparkY, sparkW, sparkH, colore);

    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`${iniziale.toFixed(decimals)}${unitaTxt}`, sparkX, sparkY + sparkH + 13);
    ctx.fillStyle = colore;
    ctx.textAlign = 'right';
    ctx.fillText(`${finale.toFixed(decimals)}${unitaTxt}`, sparkX + sparkW, sparkY + sparkH + 13);
  });

  return altezzaBlocco;
}

// Compone una card completa: mini-dashboard disegnata a mano in alto + il grafico
// catturato dal canvas subito sotto, riempiendo lo spazio verticale rimasto
function disegnaCardConMiniDashIG(ctx, x, y, w, h, immagine, serieList, unit, decimals, colore, alpha) {
  const mdH = disegnaMiniDashboardIG(ctx, x, y, w, serieList, unit, decimals, colore);
  const gapInterno = mdH ? 10 : 0;
  disegnaImmagineContenuta(ctx, immagine, x, y + mdH + gapInterno, w, h - mdH - gapInterno, alpha);
}

// Disegna un'immagine (canvas catturato) dentro un rettangolo, mantenendo le sue
// proporzioni originali (nessun taglio, nessuna deformazione) e centrandola sia in
// larghezza che in altezza nello spazio disponibile
function disegnaImmagineContenuta(ctx, sorgente, x, y, maxW, maxH, alpha = 1) {
  if (!sorgente) return;
  const scala = Math.min(maxW / sorgente.width, maxH / sorgente.height);
  const w = sorgente.width * scala;
  const h = sorgente.height * scala;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(sorgente, x + (maxW - w) / 2, y + (maxH - h) / 2, w, h);
  ctx.restore();
}

function disegnaBarraTitoloIG(ctx, testo, x, y, larghezza, altezza) {
  ctx.fillStyle = 'rgb(30, 58, 138)';
  ctx.fillRect(x, y, larghezza, altezza);
  ctx.fillStyle = '#ffffff';
  ctx.font = "800 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(testo, x + larghezza / 2, y + altezza / 2 + 2);
}

function disegnaIntestazioneSezioneIG(ctx, testo, x, y) {
  const barW = 7, barH = 30;
  const gradiente = ctx.createLinearGradient(x, y, x, y + barH);
  gradiente.addColorStop(0, '#4f46e5');
  gradiente.addColorStop(1, '#a855f7');
  ctx.fillStyle = gradiente;
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = '#0f172a';
  ctx.font = "800 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(testo.toUpperCase(), x + barW + 14, y + barH / 2 + 2);
}

// Logo di sfondo semi-trasparente, stessa identica logica del watermark già usato nel PDF.
// Se viene passato yTop, il logo viene ancorato con il bordo superiore a quell'altezza
// (usato per farlo sfiorare, a pochi mm di distanza, la barra blu del titolo o
// l'intestazione di sezione) invece di essere centrato verticalmente nella tela
async function disegnaWatermarkIG(ctx, dimensione, { yTop = null, larghezzaRel = 1.06 } = {}) {
  try {
    const img = new Image();
    img.src = FILES.logo;
    img.crossOrigin = 'anonymous';
    await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; setTimeout(resolve, 500); });
    if (img.width > 0) {
      const larghezza = dimensione * larghezzaRel;
      const altezza = larghezza / (img.width / img.height);
      const x = (dimensione - larghezza) / 2;
      const y = yTop !== null ? yTop : (dimensione - altezza) / 2;
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.drawImage(img, x, y, larghezza, altezza);
      ctx.restore();
    }
  } catch (err) {
    console.warn('Errore watermark slide Instagram:', err);
  }
}

function attesaMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Avvia il download di una tela come file PNG
function scaricaCanvasComePNG(canvas, nomeFile) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/png');
  });
}

// Genera e scarica le 3 slide quadrate (1080×1080) pronte per Instagram, catturando
// le card già visibili a schermo in quel momento (serve quindi aver già premuto
// "Elabora e Genera Report" prima di usare questo pulsante)
async function scaricaSlideInstagram() {
  if (!currentPatient) { alert('⚠️ Seleziona un paziente attivo.'); return; }

  const btn = document.getElementById('btn-slide-instagram');
  const testoOriginaleBtn = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generazione...'; }

  try {
    const sesso = currentPatient.sesso;
    const visite = ottieniStoricoFinoAVisitaSelezionata();
    if (!visite || visite.length === 0) {
      alert('⚠️ Nessuna visita disponibile per generare le slide.');
      return;
    }
    const nomePaziente = currentPatient.nominativo || 'PAZIENTE';
    const serie = costruisciSerieComplete(visite, sesso);

    const LATO = 1080;
    const MARGINE = 44;
    const CONTENUTO_W = LATO - MARGINE * 2;
    const GAP = 20;
    const ALTEZZA_RIGA = 420;
    const CELL_W = (CONTENUTO_W - GAP) / 2;
    const ALTEZZA_TITOLO = 76;
    const ALTEZZA_INTESTAZIONE = 40;
    const ALPHA_CONTENUTO = 0.65; // grafici e tabella più trasparenti: il logo di sfondo deve intravedersi bene, come nel PDF Progressione
    const DISTACCO_WATERMARK = 12; // "a pochi mm": il logo sfiora la barra blu/l'intestazione senza toccarla

    const nuovaTelaBase = () => {
      const canvas = document.createElement('canvas');
      canvas.width = LATO;
      canvas.height = LATO;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, LATO, LATO);
      return { canvas, ctx };
    };

    // ─── SLIDE 1: barra titolo + Metriche Corporee (Peso, RMR+BMR, Composizione %, Kg Massa) ───
    // Catture in sequenza (non in parallelo): riduce il picco di memoria usato dal browser,
    // uno dei possibili fattori dietro ai grafici che risultavano vuoti/sbiaditi nelle slide successive
    const cPeso = await catturaCardInstagram('chart-peso');
    const cRmrBmr = await catturaCardInstagram('chart-rmr-bmr');
    const cComposizione = await catturaCardInstagram('chart-composizione');
    const cKgMassa = await catturaCardInstagram('chart-kg-massa');

    const { canvas: canvas1, ctx: ctx1 } = nuovaTelaBase();
    let y = MARGINE;
    await disegnaWatermarkIG(ctx1, LATO, { yTop: MARGINE + ALTEZZA_TITOLO + DISTACCO_WATERMARK });
    disegnaBarraTitoloIG(ctx1, 'PROGRESSIONE ANTROPOMETRICA', MARGINE, y, CONTENUTO_W, ALTEZZA_TITOLO);
    y += ALTEZZA_TITOLO + GAP;
    disegnaIntestazioneSezioneIG(ctx1, 'Analisi dei parametri corporei', MARGINE, y);
    y += 40 + GAP;
    disegnaCardConMiniDashIG(ctx1, MARGINE, y, CELL_W, ALTEZZA_RIGA, cPeso,
      [{ label: 'Peso', valori: serie.peso }], 'kg', 1, COLORS_MINI_DASH.metriche, ALPHA_CONTENUTO);
    disegnaCardConMiniDashIG(ctx1, MARGINE + CELL_W + GAP, y, CELL_W, ALTEZZA_RIGA, cRmrBmr,
      [{ label: 'RMR', valori: serie.rmr }, { label: 'BMR', valori: serie.bmr }], 'kcal', 0, COLORS_MINI_DASH.metriche, ALPHA_CONTENUTO);
    y += ALTEZZA_RIGA + GAP;
    disegnaCardConMiniDashIG(ctx1, MARGINE, y, CELL_W, ALTEZZA_RIGA, cComposizione,
      [{ label: 'Massa Grassa', valori: serie.massaGrassaPct }, { label: 'Massa Magra', valori: serie.massaMagraPct }], '%', 1, COLORS_MINI_DASH.metriche, ALPHA_CONTENUTO);
    disegnaCardConMiniDashIG(ctx1, MARGINE + CELL_W + GAP, y, CELL_W, ALTEZZA_RIGA, cKgMassa,
      [{ label: 'Kg Grasso', valori: serie.kgGrasso }, { label: 'Kg Magro', valori: serie.kgMagro }], 'kg', 1, COLORS_MINI_DASH.metriche, ALPHA_CONTENUTO);
    [cPeso, cRmrBmr, cComposizione, cKgMassa].forEach(liberaCanvasIG);

    await scaricaCanvasComePNG(canvas1, `${nomePaziente} - Slide 1.png`);
    await attesaMs(400);

    // ─── SLIDE 2: Analisi Plicometrica (Somma Pliche + prime 2 coppie di pliche) ───
    const idPliche1 = sesso === 'M' ? 'chart-pliche-1-uomo' : 'chart-pliche-1-donna';
    const idPliche2 = sesso === 'M' ? 'chart-pliche-2-uomo' : 'chart-pliche-2-donna';
    const cSommaPliche = await catturaCardInstagram('chart-somma-pliche');
    const cPliche1 = await catturaCardInstagram(idPliche1);
    const cPliche2 = await catturaCardInstagram(idPliche2);

    const { canvas: canvas2, ctx: ctx2 } = nuovaTelaBase();
    y = MARGINE;
    await disegnaWatermarkIG(ctx2, LATO, { yTop: MARGINE + ALTEZZA_INTESTAZIONE + DISTACCO_WATERMARK });
    disegnaIntestazioneSezioneIG(ctx2, 'Analisi Plicometrica', MARGINE, y);
    y += 40 + GAP;
    const serieP1 = sesso === 'M'
      ? [{ label: 'Pettorale', valori: serie.pettorale }, { label: 'Ascellare', valori: serie.ascellare }]
      : [{ label: 'Addome', valori: serie.addome }, { label: 'Soprailiaca', valori: serie.soprailiaca }];
    const serieP2 = sesso === 'M'
      ? [{ label: 'Addome', valori: serie.addome }, { label: 'Soprailiaca', valori: serie.soprailiaca }]
      : [{ label: 'Tricipitale', valori: serie.tricipitale }, { label: 'Sottoscapolare', valori: serie.sottoscapolare }];

    disegnaCardConMiniDashIG(ctx2, MARGINE, y, CONTENUTO_W, ALTEZZA_RIGA, cSommaPliche,
      [{ label: 'Somma Pliche', valori: serie.sommaPliche }], 'mm', 1, COLORS_MINI_DASH.pliche, ALPHA_CONTENUTO);
    y += ALTEZZA_RIGA + GAP;
    disegnaCardConMiniDashIG(ctx2, MARGINE, y, CELL_W, ALTEZZA_RIGA, cPliche1, serieP1, 'mm', 1, COLORS_MINI_DASH.pliche, ALPHA_CONTENUTO);
    disegnaCardConMiniDashIG(ctx2, MARGINE + CELL_W + GAP, y, CELL_W, ALTEZZA_RIGA, cPliche2, serieP2, 'mm', 1, COLORS_MINI_DASH.pliche, ALPHA_CONTENUTO);
    [cSommaPliche, cPliche1, cPliche2].forEach(liberaCanvasIG);

    await scaricaCanvasComePNG(canvas2, `${nomePaziente} - Slide 2.png`);
    await attesaMs(400);

    // ─── SLIDE 3: Circonferenze + tabella Riepilogo Complessivo (senza testo narrativo) ───
    const idCirc1 = sesso === 'M' ? 'chart-circ-1-uomo' : 'chart-circ-1-donna';
    const cCirc1 = await catturaCardInstagram(idCirc1);
    const cCircBraccio = await catturaCardInstagram('chart-circ-braccio');

    const righeRiepilogo = costruisciRigheRiepilogoCompleto(visite, sesso);
    const htmlTabella = costruisciTabellaRiepilogoHTML(righeRiepilogo);
    const cTabella = await catturaHTMLOffscreenInstagram(htmlTabella, CONTENUTO_W, 3);

    const { canvas: canvas3, ctx: ctx3 } = nuovaTelaBase();
    y = MARGINE;
    await disegnaWatermarkIG(ctx3, LATO, { yTop: MARGINE + ALTEZZA_INTESTAZIONE + DISTACCO_WATERMARK });
    disegnaIntestazioneSezioneIG(ctx3, 'Analisi Circonferenze', MARGINE, y);
    y += 40 + GAP;
    const serieCirc1 = sesso === 'M'
      ? [{ label: 'Torace', valori: serie.torace }, { label: 'Vita', valori: serie.vita }, { label: 'Fianchi', valori: serie.fianchi }]
      : [{ label: 'Vita', valori: serie.vita }, { label: 'Fianchi', valori: serie.fianchi }, { label: 'Gluteo', valori: serie.gluteo }];

    disegnaCardConMiniDashIG(ctx3, MARGINE, y, CELL_W, ALTEZZA_RIGA, cCirc1, serieCirc1, 'cm', 1, COLORS_MINI_DASH.misure, ALPHA_CONTENUTO);
    disegnaCardConMiniDashIG(ctx3, MARGINE + CELL_W + GAP, y, CELL_W, ALTEZZA_RIGA, cCircBraccio,
      [{ label: 'Braccio', valori: serie.braccio }, { label: 'Coscia', valori: serie.circCoscia }], 'cm', 1, COLORS_MINI_DASH.misure, ALPHA_CONTENUTO);
    y += ALTEZZA_RIGA + GAP;
    disegnaIntestazioneSezioneIG(ctx3, 'Riepilogo Complessivo', MARGINE, y);
    y += 40 + GAP;
    disegnaImmagineContenuta(ctx3, cTabella, MARGINE, y, CONTENUTO_W, LATO - MARGINE - y, 1);
    [cCirc1, cCircBraccio, cTabella].forEach(liberaCanvasIG);

    await scaricaCanvasComePNG(canvas3, `${nomePaziente} - Slide 3.png`);
  } catch (err) {
    console.error(err);
    const dettaglio = (err && err.message) ? err.message : String(err);
    alert(`❌ Errore durante la generazione delle slide per Instagram.\n\nDettaglio tecnico: ${dettaglio}`);
  }

  if (btn) { btn.disabled = false; btn.innerHTML = testoOriginaleBtn; }
}
