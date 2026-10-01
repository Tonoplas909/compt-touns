// Données chargées depuis la vue Supabase `compteur_jours` :
// { "AAAA-MM-JJ": { notamment: n, on_va_dire: n, siris: n } }
const LABELS = { notamment: 'notamment', on_va_dire: 'on va dire', siris: 'SIRIS' };
const EXPRESSIONS = Object.keys(LABELS); // = colonnes de la vue SQL
const TIME_ZONE = 'Europe/Paris'; // doit correspondre à la vue SQL
const CHART_DAYS = 14;

const { supabaseUrl, supabaseKey } = window.COMPTEUR_CONFIG || {};
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let data = {};
let pending = 0; // clics envoyés mais pas encore confirmés

// --- Dates (toujours à l'heure de Paris) ---

const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const longDate = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const tinyDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'numeric' });
const dayOfMonth = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric' });

function todayKey() {
  return keyFormat.format(new Date());
}

// Clé "AAAA-MM-JJ" → Date à midi UTC, pour l'affichage et le calcul des jours précédents.
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function shiftKey(key, days) {
  const date = parseKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayTotal(entry) {
  return EXPRESSIONS.reduce((sum, expr) => sum + (entry?.[expr] || 0), 0);
}

// --- Supabase ---

function setStatus(state, text) {
  const el = document.getElementById('status');
  el.dataset.state = state;
  el.textContent = text;
}

async function fetchData() {
  const { data: rows, error } = await db.from('compteur_jours').select(['jour', ...EXPRESSIONS].join(', '));
  if (error) throw error;
  const next = {};
  for (const row of rows) {
    const entry = Object.fromEntries(EXPRESSIONS.map((expr) => [expr, row[expr] || 0]));
    if (dayTotal(entry) > 0) next[row.jour] = entry;
  }
  return next;
}

let lastRequest = 0;
async function refresh() {
  const request = ++lastRequest;
  try {
    const next = await fetchData();
    if (request !== lastRequest) return; // une requête plus récente est partie entre-temps
    // On évite d'écraser l'affichage optimiste pendant qu'un clic est en cours d'envoi.
    if (pending === 0) data = next;
    setStatus('ok', 'Synchronisé');
    setButtonsEnabled(true);
  } catch (err) {
    console.error(err);
    if (request !== lastRequest) return;
    setStatus('error', 'Impossible de charger les données');
  }
  render();
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 300);
}

async function change(expr, delta) {
  const today = todayKey();
  const entry = data[today] || Object.fromEntries(EXPRESSIONS.map((e) => [e, 0]));
  if (delta < 0 && !entry[expr]) return;

  // Affichage immédiat, confirmé (ou annulé) par la réponse du serveur.
  entry[expr] += delta;
  data[today] = entry;
  pending++;
  render();
  if (delta > 0) bump(expr);

  const { error } = await db.from('compteur_events').insert({ expression: expr, delta });
  pending--;
  if (error) {
    console.error(error);
    setStatus('error', "Le clic n'a pas été enregistré");
  }
  scheduleRefresh();
}

function bump(expr) {
  if (navigator.vibrate) navigator.vibrate(15);
  const countEl = document.querySelector(`.counter[data-expr="${expr}"] .count`);
  countEl.classList.remove('bump');
  void countEl.offsetWidth; // relance l'animation
  countEl.classList.add('bump');
}

function setButtonsEnabled(enabled) {
  for (const btn of document.querySelectorAll('.plus')) btn.disabled = !enabled;
  if (!enabled) for (const btn of document.querySelectorAll('.minus')) btn.disabled = true;
}

// --- Affichage ---

function render() {
  const today = todayKey();
  const todayEntry = data[today] || {};
  const ready = !document.querySelector('.plus').disabled;

  document.getElementById('today-label').textContent = longDate.format(new Date());

  for (const expr of EXPRESSIONS) {
    const card = document.querySelector(`.counter[data-expr="${expr}"]`);
    const n = todayEntry[expr] || 0;
    card.querySelector('.count').textContent = n;
    card.querySelector('.minus').disabled = !ready || n === 0;
  }

  const days = Object.keys(data).filter((day) => dayTotal(data[day]) > 0).sort().reverse();
  renderStats(days);
  renderChart(today);
  renderHistory(days, today);
}

function renderStats(days) {
  const totals = days.map((day) => dayTotal(data[day]));
  const total = totals.reduce((a, b) => a + b, 0);
  const avg = days.length ? total / days.length : 0;
  let recordDay = null;
  let record = 0;
  days.forEach((day, i) => {
    if (totals[i] > record) { record = totals[i]; recordDay = day; }
  });

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-avg').textContent = avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  document.getElementById('stat-record').textContent = record;
  document.getElementById('stat-record-label').textContent =
    recordDay ? `record (${tinyDate.format(parseKey(recordDay))})` : 'record';
}

function renderChart(today) {
  const chart = document.getElementById('chart');
  const keys = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) keys.push(shiftKey(today, -i));
  const max = Math.max(1, ...keys.map((k) => dayTotal(data[k])));

  chart.replaceChildren(...keys.map((key) => {
    const entry = data[key] || {};
    const total = dayTotal(entry);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.title = `${shortDate.format(parseKey(key))} : ` +
      EXPRESSIONS.map((expr) => `${entry[expr] || 0} ${LABELS[expr]}`).join(', ');

    const label = document.createElement('div');
    label.className = 'total';
    label.textContent = total || '';

    const stack = document.createElement('div');
    stack.className = 'stack';
    for (const expr of EXPRESSIONS) {
      const seg = document.createElement('div');
      seg.className = `seg ${expr}`;
      // 110px = hauteur utile du graphique (hors libellés)
      seg.style.height = `${((entry[expr] || 0) / max) * 110}px`;
      stack.append(seg);
    }

    const day = document.createElement('div');
    day.className = 'day';
    day.textContent = dayOfMonth.format(parseKey(key));

    bar.append(label, stack, day);
    return bar;
  }));
}

function renderHistory(days, today) {
  const body = document.getElementById('history-body');
  body.replaceChildren(...days.map((day) => {
    const entry = data[day];
    const tr = document.createElement('tr');
    if (day === today) tr.classList.add('is-today');
    const cells = [
      [day === today ? "Aujourd'hui" : shortDate.format(parseKey(day)), ''],
      ...EXPRESSIONS.map((expr) => [entry[expr] || 0, expr]),
      [dayTotal(entry), ''],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.append(td);
    }
    return tr;
  }));
  document.getElementById('history-empty').hidden = days.length > 0;
  document.querySelector('.history').hidden = days.length === 0;
}

// --- Défis : mots à faire dire au prof (table `defis`) ---

let defis = [];
const validatedDate = new Intl.DateTimeFormat('fr-FR', { timeZone: TIME_ZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function setDefiMessage(text, isError = false) {
  const el = document.getElementById('defi-message');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

let lastDefisRequest = 0;
async function refreshDefis() {
  const request = ++lastDefisRequest;
  const { data: rows, error } = await db.from('defis').select('id, mot, created_at, validated_at').order('created_at');
  if (request !== lastDefisRequest) return;
  if (error) {
    console.error(error);
    setDefiMessage('Impossible de charger les défis', true);
    return;
  }
  defis = rows;
  renderDefis();
}

let defisTimer = null;
function scheduleDefisRefresh() {
  clearTimeout(defisTimer);
  defisTimer = setTimeout(refreshDefis, 300);
}

async function addDefi(event) {
  event.preventDefault();
  const input = document.getElementById('defi-input');
  const button = event.target.querySelector('button');
  const mot = input.value.replace(/\s+/g, ' ').trim();
  if (!mot) return;

  button.disabled = true;
  const { error } = await db.from('defis').insert({ mot });
  button.disabled = false;

  if (error) {
    console.error(error);
    setDefiMessage(error.code === '23505' ? `« ${mot} » est déjà dans la file d'attente.` : "Le mot n'a pas pu être ajouté.", true);
    return;
  }
  input.value = '';
  setDefiMessage(`« ${mot} » ajouté à la file d'attente.`);
  refreshDefis();
}

async function validerDefi(defi, button) {
  if (!confirm(`Il a dit « ${defi.mot} » ?`)) return;
  button.disabled = true;
  const { error } = await db.rpc('valider_defi', { defi_id: defi.id });
  if (error) {
    console.error(error);
    button.disabled = false;
    setDefiMessage("La validation n'a pas pu être enregistrée.", true);
    return;
  }
  setDefiMessage(`« ${defi.mot} » validé !`);
  refreshDefis();
}

function renderDefis() {
  const pending = defis.filter((d) => !d.validated_at);
  const done = defis.filter((d) => d.validated_at).sort((a, b) => b.validated_at.localeCompare(a.validated_at));

  document.getElementById('defis-pending').replaceChildren(...pending.map((defi) => {
    const li = document.createElement('li');
    const mot = document.createElement('span');
    mot.className = 'mot';
    mot.textContent = defi.mot;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'valider';
    button.textContent = "Il l'a dit ✓";
    button.addEventListener('click', () => validerDefi(defi, button));
    li.append(mot, button);
    return li;
  }));

  document.getElementById('defis-done').replaceChildren(...done.map((defi) => {
    const li = document.createElement('li');
    const mot = document.createElement('span');
    mot.className = 'mot';
    mot.textContent = defi.mot;
    const quand = document.createElement('span');
    quand.className = 'quand';
    quand.textContent = validatedDate.format(new Date(defi.validated_at));
    li.append(mot, quand);
    return li;
  }));

  document.getElementById('defis-pending-count').textContent = pending.length;
  document.getElementById('defis-done-count').textContent = done.length;
  document.getElementById('defis-pending-empty').hidden = pending.length > 0;
  document.getElementById('defis-done-empty').hidden = done.length > 0;
}

// --- Démarrage ---

for (const card of document.querySelectorAll('.counter')) {
  const expr = card.dataset.expr;
  card.querySelector('.plus').addEventListener('click', () => change(expr, 1));
  card.querySelector('.minus').addEventListener('click', () => change(expr, -1));
}
document.getElementById('defi-form').addEventListener('submit', addDefi);

// Temps réel : un changement sur un autre appareil déclenche un rechargement.
db.channel('compt-touns')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'compteur_events' }, scheduleRefresh)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'defis' }, scheduleDefisRefresh)
  .subscribe((state) => {
    if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('warn', 'Temps réel indisponible (rechargez la page)');
  });

// Retour sur l'onglet ou changement de jour : on resynchronise.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); refreshDefis(); } });
setInterval(render, 60_000);

render();
renderDefis();
refresh();
refreshDefis();
