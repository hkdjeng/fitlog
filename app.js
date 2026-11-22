'use strict';
/* FitLog: a free, offline-first fitness and calorie tracker.
 * All data lives in this browser (localStorage). Backups: a JSON file you
 * save anywhere, or a file in your own Google Drive.
 * Calorie numbers are ESTIMATES (see README "How calories are estimated").
 */

const KEY = 'fitlog.v1';
const DRIVE_FILE = 'FitLog backup.json';

// MET values: approximations from the Compendium of Physical Activities (2011).
const TYPES = {
  gym:       { label: 'Gym',       icon: '🏋️', met: { light: 3.5, moderate: 5.0, hard: 6.0 } },
  run:       { label: 'Running',   icon: '🏃', met: { light: 7.0, moderate: 9.8, hard: 11.5 } },
  badminton: { label: 'Badminton', icon: '🏸', met: { light: 4.5, moderate: 5.5, hard: 7.0 } },
  trek:      { label: 'Trekking',  icon: '🥾', met: { light: 4.5, moderate: 6.0, hard: 7.8 } },
};
// Line icons (24x24, stroked) in a calm, Apple-like style.
const ICON_PATHS = {
  gym: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3.5-5.5 3 2.5V22M11.5 15.5l1.5-6.5-3.5 1.5-2 3M13 9l2.5 3.5 3.5 .5"/>',
  badminton: '<path d="M12 21.5a2 2 0 0 0 2-2l3-9.5H7l3 9.5a2 2 0 0 0 2 2zM7 10L5 3.5M17 10l2-6.5M10.3 10l-.8-7M13.7 10l.8-7"/>',
  trek: '<path d="M2.5 20L9 8.5l4 6.5 2.5-3.5 6 8.5z"/>',
  food: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2.2 0-3.5 3-3.5 7.5H17"/>',
  weight: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.3-2"/>',
  camera: '<path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><circle cx="12" cy="13.5" r="3.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
};
const svgIcon = (k) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[k]}</svg>`;
const tile = (k) => `<span class="ic ic-${k}">${svgIcon(k)}</span>`;
const INTENSITY = { light: 'Light', moderate: 'Moderate', hard: 'Hard' };
const INTENSITY_HINT = {
  gym: { light: 'light weights, long rests', moderate: 'normal session', hard: 'heavy, short rests / circuits' },
  run: { light: 'easy jog', moderate: 'steady run', hard: 'fast / intervals' },
  badminton: { light: 'casual rally', moderate: 'social doubles', hard: 'competitive singles' },
  trek: { light: 'flat walk', moderate: 'hills', hard: 'steep with a heavy pack' },
};
// Running MET by speed (km/h), Compendium 2011.
const RUN_MET = [[6.4, 6.0], [8.0, 8.3], [8.4, 9.0], [9.7, 9.8], [10.8, 10.5], [11.3, 11.0], [12.1, 11.5],
  [12.9, 11.8], [13.8, 12.3], [14.5, 12.8], [16.1, 14.5], [17.7, 16.0], [19.3, 19.0]];
const ACTIVITY_LEVELS = [
  [1.2, 'Mostly sitting (desk job, student)'],
  [1.375, 'On my feet part of the day'],
  [1.55, 'On my feet most of the day (active job)'],
];
const GOALS = [
  [0, 'Maintain weight'],
  [-250, 'Lose about 0.25 kg / week'],
  [-500, 'Lose about 0.5 kg / week'],
  [250, 'Gain about 0.25 kg / week'],
];
const MEASURES = [ // key, label, unit
  ['waist', 'Waist', 'cm'], ['hips', 'Hips', 'cm'], ['chest', 'Chest', 'cm'],
  ['arm', 'Upper arm', 'cm'], ['thigh', 'Thigh', 'cm'], ['bodyFat', 'Body fat', '%'],
];
const PROTEIN_LEVELS = [[1.2, 'Moderate: 1.2 g per kg'], [1.6, 'Recommended for toning: 1.6 g per kg'], [2.0, 'High (heavy lifting): 2.0 g per kg']];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const COMMON_EXERCISES = ['Bench press', 'Incline bench press', 'Dumbbell press', 'Overhead press', 'Squat', 'Front squat',
  'Leg press', 'Deadlift', 'Romanian deadlift', 'Lunge', 'Pull-up', 'Chin-up', 'Lat pulldown', 'Barbell row',
  'Dumbbell row', 'Seated cable row', 'Bicep curl', 'Hammer curl', 'Tricep pushdown', 'Dips', 'Lateral raise',
  'Face pull', 'Leg curl', 'Leg extension', 'Calf raise', 'Hip thrust', 'Plank', 'Push-up', 'Crunch'];

/* ---------- state ---------- */
function fresh() {
  return {
    version: 1,
    profile: { set: false, sex: 'male', age: 30, heightCm: 170, weightKg: 70, activity: 1.2, goal: 0, targetKg: 0, startKg: 0, startDate: '', proteinPerKg: 1.6 },
    activities: [], foods: [], weights: [], measurements: [],
    settings: { clientId: '', lastBackup: null, lastBackupWhere: null, geminiModel: '' },
    updatedAt: new Date().toISOString(),
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version) return normalize(s);
  } catch (e) { /* fall through */ }
  return fresh();
}
function normalize(s) {
  const f = fresh();
  return {
    ...f, ...s,
    profile: { ...f.profile, ...(s.profile || {}) },
    settings: { ...f.settings, ...(s.settings || {}) },
    activities: s.activities || [], foods: s.foods || [], weights: s.weights || [], measurements: s.measurements || [],
  };
}
let state = load();
function save() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(state));
  scheduleAutoBackup();
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const fmt = (n) => Math.round(n).toLocaleString();
const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString();
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const todayStr = () => ymd(new Date());
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function fmtDate(s, opts) {
  if (s === todayStr()) return 'Today';
  if (s === addDays(todayStr(), -1)) return 'Yesterday';
  return parseYmd(s).toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' });
}
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
function fmtDuration(min) { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`; }
function pace(distKm, min) {
  if (!(distKm > 0 && min > 0)) return '';
  const p = min / distKm; const mm = Math.floor(p), ss = Math.round((p - mm) * 60);
  return `${mm}:${String(ss === 60 ? 0 : ss).padStart(2, '0')} /km`;
}

/* ---------- calorie model ---------- */
function weightOn(date) {
  let best = null;
  for (const w of state.weights) if (w.date <= date && (!best || w.date > best.date)) best = w;
  return best ? best.kg : state.profile.weightKg;
}
function runMet(kmh) {
  if (kmh <= RUN_MET[0][0]) return RUN_MET[0][1];
  for (let i = 1; i < RUN_MET.length; i++) {
    const [x1, y1] = RUN_MET[i - 1], [x2, y2] = RUN_MET[i];
    if (kmh <= x2) return y1 + (y2 - y1) * (kmh - x1) / (x2 - x1);
  }
  return RUN_MET[RUN_MET.length - 1][1];
}
function activityMet(a) {
  if (a.type === 'run' && a.distanceKm > 0 && a.durationMin > 0) return runMet(a.distanceKm / (a.durationMin / 60));
  return TYPES[a.type].met[a.intensity || 'moderate'];
}
// Net calories ON TOP of resting burn: (MET - 1) x kg x hours. Resting burn is counted in BMR.
function estimateKcal(a) { return Math.round(Math.max(activityMet(a) - 1, 0) * weightOn(a.date) * (num(a.durationMin) / 60)); }
function activityKcal(a) { return a.kcalOverride > 0 ? Math.round(a.kcalOverride) : estimateKcal(a); }
function proteinTarget(date) { return Math.round(num(state.profile.proteinPerKg || 1.6) * weightOn(date)); }
function measureSummary(m) {
  return MEASURES.filter(([k]) => m[k] > 0).map(([k, l, u]) => `${l} ${fmt1(m[k])}${u === '%' ? '%' : ' ' + u}`).join(' · ');
}
// Weight goal progress, or null when no target is set.
function goalProgress() {
  const p = state.profile;
  if (!(p.targetKg > 0)) return null;
  const cur = weightOn(todayStr());
  const start = p.startKg > 0 ? p.startKg : cur;
  const total = start - p.targetKg, done = start - cur;
  const pct = total === 0 ? 100 : Math.max(0, Math.min(100, (done / total) * 100));
  const left = cur - p.targetKg;
  const perWeek = -num(p.goal) * 7 / 7700; // kg per week implied by the calorie goal
  const weeks = perWeek > 0 && left > 0 ? Math.ceil(left / perWeek) : null;
  return { cur, start, target: p.targetKg, pct, left, weeks, losing: total >= 0 };
}
function goalCard(compact) {
  const g = goalProgress();
  if (!g) return '';
  const reached = g.losing ? g.left <= 0 : g.left >= 0;
  return `<section class="card"><h2>Weight goal</h2>
    <div class="row spread"><div><div class="goalbig">${reached ? 'Goal reached' : `${fmt1(Math.abs(g.left))} kg to go`}</div>
      <div class="muted small">${fmt1(g.start)} → <b>${fmt1(g.cur)}</b> → ${fmt1(g.target)} kg</div></div>
      ${!compact && g.weeks ? `<div class="muted small" style="text-align:right">about ${g.weeks} week${g.weeks > 1 ? 's' : ''}<br>at your calorie goal</div>` : ''}</div>
    <div class="pbar"><div style="width:${reached ? 100 : g.pct}%"></div></div>
  </section>`;
}
function bmr(date) { // Mifflin-St Jeor
  const p = state.profile;
  return 10 * weightOn(date) + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'female' ? -161 : 5);
}
function dayStats(date) {
  const foods = state.foods.filter((f) => f.date === date);
  const acts = state.activities.filter((a) => a.date === date);
  const eaten = foods.reduce((s, f) => s + num(f.kcal), 0);
  const exercise = acts.reduce((s, a) => s + activityKcal(a), 0);
  const base = Math.round(bmr(date) * state.profile.activity);
  const burned = base + exercise;
  const target = burned + num(state.profile.goal);
  return { foods, acts, eaten, exercise, base, burned, target, balance: eaten - burned, remaining: target - eaten };
}

/* ---------- navigation ---------- */
let view = 'today';
let curDate = todayStr();
let histFilter = 'all';
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); window.scrollTo(0, 0); }));
$('#fab').addEventListener('click', () => openAddMenu());

function render() {
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#fab').style.display = 'none';
  $('#topActions').innerHTML = '';
  ({ today: renderToday, history: renderHistory, progress: renderProgress, settings: renderSettings })[view]();
  if (view === 'history' || view === 'progress') {
    $('#topActions').innerHTML = `<button class="navplus" id="navAdd" aria-label="Add entry">${svgIcon('plus')}</button>`;
    $('#navAdd').onclick = () => openAddMenu();
  }
  refreshDatalists();
}

/* ---------- Today ---------- */
function renderToday() {
  $('#title').textContent = curDate === todayStr() ? 'Today' : 'Summary';
  $('#topActions').innerHTML = `<div class="datenav">
    <button id="prevDay" aria-label="Previous day">${svgIcon('left')}</button>
    <span class="label">${esc(curDate === todayStr() ? parseYmd(curDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : fmtDate(curDate))}</span>
    <button id="nextDay" aria-label="Next day" ${curDate >= todayStr() ? 'disabled' : ''}>${svgIcon('right')}</button></div>`;
  $('#prevDay').onclick = () => { curDate = addDays(curDate, -1); render(); };
  $('#nextDay').onclick = () => { if (curDate < todayStr()) { curDate = addDays(curDate, 1); render(); } };

  const s = dayStats(curDate);
  const pct = s.target > 0 ? Math.min(100, (s.eaten / s.target) * 100) : 0;
  const over = s.remaining < 0;
  let html = '';
  if (!state.profile.set) {
    html += `<div class="banner">Set your age, height and weight first so calorie numbers fit you.<br><button class="primary" id="goProfile">Set up profile</button></div>`;
  }
  html += backupReminder();
  html += `<section class="card">
    <h2>Calories</h2>
    <div class="ringwrap">
      <div class="ring ${over ? 'over' : ''}" role="img" aria-label="${fmt(s.eaten)} of ${fmt(s.target)} kcal eaten">
        <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="50" fill="none" stroke-width="14"/>
          <circle class="prog" cx="60" cy="60" r="50" fill="none" stroke-width="14" stroke-linecap="round"
            stroke-dasharray="314.16" stroke-dashoffset="${314.16 * (1 - Math.max(pct, 0.5) / 100)}"/></svg>
        <div class="center"><div class="big">${fmt(Math.abs(s.remaining))}</div><div class="muted">${over ? 'over' : 'kcal left'}</div></div>
      </div>
      <div class="calstats">
        <div><div class="k">Eaten</div><div class="v">${fmt(s.eaten)}</div></div>
        <div><div class="k">Exercise</div><div class="v">${fmt(s.exercise)}</div></div>
        <div><div class="k">Target</div><div class="v">${fmt(s.target)}</div></div>
      </div>
    </div>
    ${macroLine(s.foods, curDate)}
    <p class="calnote">Balance <b class="${s.balance > 0 ? 'pos' : 'neg'}">${s.balance > 0 ? '+' : ''}${fmt(s.balance)} kcal</b> · you burn about ${fmt(s.burned)} today (${fmt(s.base)} resting and daily life + ${fmt(s.exercise)} exercise)</p>
  </section>`;

  if (curDate === todayStr()) html += goalCard(true);
  html += `<section class="card"><h2>Log</h2><div class="quick">
    ${Object.keys(TYPES).map((k) => `<button data-add="${k}">${tile(k)}${TYPES[k].label}</button>`).join('')}
    <button data-add="food">${tile('food')}Food</button>
    <button data-add="weight">${tile('weight')}Body</button></div></section>`;

  html += `<section class="card"><h2>Workouts</h2>${s.acts.length ? `<ul class="list">${s.acts.map(actRow).join('')}</ul>` : '<div class="empty">No workouts logged.</div>'}</section>`;

  html += `<section class="card"><h2>Food</h2>${s.foods.length ? `<ul class="list">${MEALS.flatMap((m) => s.foods.filter((f) => f.meal === m)).map(foodRow).join('')}</ul>` : '<div class="empty">Nothing logged yet.</div>'}</section>`;

  $('#view').innerHTML = html;
  const gp = $('#goProfile'); if (gp) gp.onclick = () => { view = 'settings'; render(); };
  const gb = $('#goBackup'); if (gb) gb.onclick = () => { view = 'settings'; render(); setTimeout(() => $('#backupCard')?.scrollIntoView(), 50); };
  bindRows($('#view'));
  $('#view').querySelectorAll('[data-add]').forEach((b) => b.onclick = () => openForm(b.dataset.add, null, curDate));
}
function actSummary(a) {
  const parts = [fmtDuration(a.durationMin)];
  if (a.distanceKm > 0) parts.push(`${fmt1(a.distanceKm)} km`);
  if (a.type === 'run' && a.distanceKm > 0) parts.push(pace(a.distanceKm, a.durationMin));
  if (a.type === 'gym' && a.exercises?.length) {
    const sets = a.exercises.reduce((s, e) => s + e.sets.length, 0);
    parts.push(`${a.exercises.length} exercises, ${sets} sets`);
  } else if (a.type !== 'run' || !(a.distanceKm > 0)) parts.push(INTENSITY[a.intensity] || '');
  return parts.filter(Boolean).join(' · ');
}
function actRow(a) {
  const t = TYPES[a.type];
  const title = a.type === 'gym' && a.exercises?.length ? a.exercises.map((e) => e.name).slice(0, 3).join(', ') + (a.exercises.length > 3 ? '…' : '') : t.label;
  return `<li data-edit="act:${a.id}">${tile(a.type)}<div class="grow"><div>${esc(title)}</div><div class="muted small">${esc(actSummary(a))}</div></div><span class="kcal">${fmt(activityKcal(a))} kcal</span></li>`;
}
function macroLine(foods, date) {
  const sum = (k) => foods.reduce((x, f) => x + num(f[k]), 0);
  const pt = proteinTarget(date), pr = sum('protein');
  const has = foods.some((f) => f.carbs != null || f.fat != null);
  return `<div class="protein"><div class="row spread small"><span>Protein</span><span><b>${fmt(pr)}</b> / ${fmt(pt)} g</span></div>
    <div class="pbar protein-bar"><div style="width:${Math.min(100, pt ? (pr / pt) * 100 : 0)}%"></div></div>
    ${has ? `<div class="muted small">Carbs ${fmt(sum('carbs'))} g · Fat ${fmt(sum('fat'))} g</div>` : ''}</div>`;
}
function foodRow(f) {
  return `<li data-edit="food:${f.id}">${tile('food')}<div class="grow"><div>${esc(f.name || 'Food')}</div><div class="muted small">${esc(f.meal)}${f.protein != null ? ` · P ${fmt(f.protein)} · C ${fmt(num(f.carbs))} · F ${fmt(num(f.fat))} g` : ''}${f.ai ? ' · AI estimate' : ''}</div></div><span class="kcal">${fmt(f.kcal)} kcal</span></li>`;
}
function measureRow(m) {
  return `<li data-edit="measure:${m.id}">${tile('weight')}<div class="grow"><div>Measurements</div><div class="muted small">${esc(measureSummary(m))}</div></div></li>`;
}
function weightRow(w) {
  return `<li data-edit="weight:${w.id}">${tile('weight')}<div class="grow"><div>Weight</div></div><span class="kcal">${fmt1(w.kg)} kg</span></li>`;
}
function bindRows(root) {
  root.querySelectorAll('[data-edit]').forEach((li) => li.onclick = () => {
    const [kind, id] = li.dataset.edit.split(':');
    if (kind === 'act') { const a = state.activities.find((x) => x.id === id); if (a) openForm(a.type, a); }
    if (kind === 'food') { const f = state.foods.find((x) => x.id === id); if (f) openForm('food', f); }
    if (kind === 'weight') { const w = state.weights.find((x) => x.id === id); if (w) openForm('weight', { date: w.date, edit: true }); }
    if (kind === 'measure') { const m = state.measurements.find((x) => x.id === id); if (m) openForm('weight', { date: m.date, edit: true }); }
  });
}
function backupReminder() {
  const n = state.activities.length + state.foods.length + state.weights.length;
  if (n < 5) return '';
  const last = state.settings.lastBackup ? new Date(state.settings.lastBackup) : null;
  const days = last ? (Date.now() - last) / 864e5 : Infinity;
  if (days < 7) return '';
  return `<div class="banner">${last ? `Last backup was ${Math.floor(days)} days ago.` : 'You have not backed up yet.'} Your data only lives on this phone until you do.<br><button id="goBackup">Back up now</button></div>`;
}

/* ---------- Add menu & forms ---------- */
const sheet = $('#sheet');
function openSheet(html) {
  $('#sheetBody').innerHTML = html;
  if (!sheet.open) sheet.showModal();
}
function closeSheet() { sheet.close(); }
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

function openAddMenu() {
  const d = view === 'today' ? curDate : todayStr();
  openSheet(`<h3>Add to ${esc(fmtDate(d))}</h3><div class="quick">
    ${Object.keys(TYPES).map((k) => `<button data-add="${k}">${tile(k)}${TYPES[k].label}</button>`).join('')}
    <button data-add="food">${tile('food')}Food</button><button data-add="weight">${tile('weight')}Body</button></div>
    <div class="actions"><button id="cancel">Cancel</button></div>`);
  $('#sheetBody').querySelectorAll('[data-add]').forEach((b) => b.onclick = () => openForm(b.dataset.add, null, d));
  $('#cancel').onclick = closeSheet;
}

function openForm(kind, item, date) {
  if (kind === 'food') return foodForm(item, date);
  if (kind === 'weight') return weightForm(item, date);
  if (kind === 'gym') return gymForm(item, date);
  return cardioForm(kind, item, date);
}
function formActions(item) {
  return `<div class="actions">${item ? '<button type="button" class="danger" id="del">Delete</button>' : '<button type="button" id="cancel">Cancel</button>'}<button class="primary" type="submit">Save</button></div>`;
}
function wireForm(onSave, onDelete) {
  const form = $('#sheetBody form');
  form.onsubmit = (e) => { e.preventDefault(); if (onSave(new FormData(form)) !== false) { save(); closeSheet(); render(); } };
  const c = $('#cancel'); if (c) c.onclick = closeSheet;
  const d = $('#del'); if (d) d.onclick = () => { if (confirm('Delete this entry?')) { onDelete(); save(); closeSheet(); render(); toast('Deleted'); } };
  return form;
}
function intensityOptions(type, cur) {
  return Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${k === (cur || 'moderate') ? 'selected' : ''}>${v}: ${INTENSITY_HINT[type][k]}</option>`).join('');
}

function cardioForm(type, a, date) {
  const t = TYPES[type];
  const hasDist = type !== 'badminton';
  openSheet(`<form><h3>${a ? 'Edit' : 'Log'} ${t.label}</h3>
    <label class="f">Date<input type="date" name="date" value="${esc(a?.date || date)}" max="${todayStr()}" required></label>
    <div class="two">
      <label class="f">Duration (min)<input type="number" name="durationMin" inputmode="decimal" min="1" step="any" value="${esc(a?.durationMin || '')}" required></label>
      ${hasDist ? `<label class="f">Distance (km)<input type="number" name="distanceKm" inputmode="decimal" min="0" step="any" value="${esc(a?.distanceKm || '')}"></label>` : '<div></div>'}
    </div>
    ${type === 'trek' ? `<label class="f">Elevation gain (m, optional)<input type="number" name="elevationM" inputmode="numeric" min="0" value="${esc(a?.elevationM || '')}"></label>` : ''}
    <label class="f">Intensity<select name="intensity">${intensityOptions(type, a?.intensity)}</select></label>
    <label class="f">Calories from your watch (optional, overrides estimate)<input type="number" name="kcalOverride" inputmode="numeric" min="0" value="${esc(a?.kcalOverride || '')}"></label>
    <div class="estimate" id="est"></div>
    <label class="f">Notes<textarea name="notes">${esc(a?.notes || '')}</textarea></label>
    ${formActions(a)}</form>`);
  const form = wireForm((fd) => {
    const rec = {
      id: a?.id || uid(), type, date: fd.get('date'), durationMin: num(fd.get('durationMin')),
      distanceKm: num(fd.get('distanceKm')), elevationM: num(fd.get('elevationM')),
      intensity: fd.get('intensity'), kcalOverride: num(fd.get('kcalOverride')), notes: fd.get('notes') || '',
    };
    upsert(state.activities, rec);
    toast(`${t.label} saved`);
  }, () => remove(state.activities, a.id));
  const upd = () => {
    const fd = new FormData(form);
    const tmp = { type, date: fd.get('date') || date, durationMin: num(fd.get('durationMin')), distanceKm: num(fd.get('distanceKm')), intensity: fd.get('intensity') };
    let txt = `Estimated burn: <b>${fmt(estimateKcal(tmp))} kcal</b> above resting`;
    if (type === 'run' && tmp.distanceKm > 0 && tmp.durationMin > 0) txt += ` · pace ${pace(tmp.distanceKm, tmp.durationMin)} (pace is used instead of intensity)`;
    if (num(fd.get('kcalOverride')) > 0) txt += ` · using your watch value`;
    $('#est').innerHTML = txt;
  };
  form.addEventListener('input', upd); upd();
}

function lastPerformance(name, excludeId) {
  if (!name) return '';
  const n = name.trim().toLowerCase();
  const sessions = state.activities.filter((a) => a.type === 'gym' && a.id !== excludeId && a.exercises?.some((e) => e.name.trim().toLowerCase() === n))
    .sort((x, y) => (y.date + (y.id || '')).localeCompare(x.date + (x.id || '')));
  if (!sessions.length) return '';
  const ex = sessions[0].exercises.find((e) => e.name.trim().toLowerCase() === n);
  return `Last time (${fmtDate(sessions[0].date, { day: 'numeric', month: 'short' })}): ` + ex.sets.map((s) => `${s.reps}×${s.kg ? fmt1(s.kg) + 'kg' : 'BW'}`).join(', ');
}
function gymForm(a, date) {
  let ex = a ? JSON.parse(JSON.stringify(a.exercises || [])) : [];
  if (!ex.length) ex = [{ name: '', sets: [{ reps: '', kg: '' }] }];
  openSheet(`<form><h3>${a ? 'Edit' : 'Log'} Gym Session</h3>
    <label class="f">Date<input type="date" name="date" value="${esc(a?.date || date)}" max="${todayStr()}" required></label>
    <div class="two">
      <label class="f">Duration (min)<input type="number" name="durationMin" inputmode="decimal" min="1" step="any" value="${esc(a?.durationMin || '')}" required></label>
      <label class="f">Intensity<select name="intensity">${Object.entries(INTENSITY).map(([k, v]) => `<option value="${k}" ${k === (a?.intensity || 'moderate') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <div id="exs"></div>
    <button type="button" id="addEx" style="width:100%;margin-bottom:12px">+ Add exercise</button>
    <label class="f">Calories from your watch (optional)<input type="number" name="kcalOverride" inputmode="numeric" min="0" value="${esc(a?.kcalOverride || '')}"></label>
    <div class="estimate" id="est"></div>
    <label class="f">Notes<textarea name="notes">${esc(a?.notes || '')}</textarea></label>
    ${formActions(a)}</form>`);
  const box = $('#exs');
  const drawEx = () => {
    box.innerHTML = ex.map((e, i) => `<div class="ex" data-i="${i}">
      <div class="row"><input class="grow" list="exList" placeholder="Exercise name" data-f="name" value="${esc(e.name)}">
        <button type="button" class="link danger" data-act="rmEx" aria-label="Remove exercise">✕</button></div>
      <div class="hint">${esc(lastPerformance(e.name, a?.id))}</div>
      <div class="sethead"><span>Set</span><span>Reps</span><span>kg</span><span></span></div>
      ${e.sets.map((s, j) => `<div class="set" data-j="${j}"><span class="n">${j + 1}</span>
        <input type="number" inputmode="numeric" min="0" data-f="reps" value="${esc(s.reps)}" placeholder="reps">
        <input type="number" inputmode="decimal" min="0" step="any" data-f="kg" value="${esc(s.kg)}" placeholder="body wt">
        <button type="button" data-act="rmSet" aria-label="Remove set">−</button></div>`).join('')}
      <button type="button" class="link" data-act="addSet">+ Add set</button></div>`).join('');
  };
  drawEx();
  box.addEventListener('input', (e) => {
    const el = e.target, exEl = el.closest('.ex'); if (!exEl) return;
    const i = +exEl.dataset.i;
    if (el.dataset.f === 'name') { ex[i].name = el.value; exEl.querySelector('.hint').textContent = lastPerformance(el.value, a?.id); return; }
    const j = +el.closest('.set').dataset.j; ex[i].sets[j][el.dataset.f] = el.value;
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const i = +b.closest('.ex').dataset.i;
    if (b.dataset.act === 'addSet') { const last = ex[i].sets[ex[i].sets.length - 1] || { reps: '', kg: '' }; ex[i].sets.push({ ...last }); }
    if (b.dataset.act === 'rmSet') { ex[i].sets.splice(+b.closest('.set').dataset.j, 1); if (!ex[i].sets.length) ex[i].sets.push({ reps: '', kg: '' }); }
    if (b.dataset.act === 'rmEx') { ex.splice(i, 1); if (!ex.length) ex.push({ name: '', sets: [{ reps: '', kg: '' }] }); }
    drawEx(); upd();
  });
  $('#addEx').onclick = () => { ex.push({ name: '', sets: [{ reps: '', kg: '' }] }); drawEx(); box.lastElementChild.querySelector('input').focus(); };
  const form = wireForm((fd) => {
    const exercises = ex.map((e) => ({ name: e.name.trim(), sets: e.sets.filter((s) => num(s.reps) > 0).map((s) => ({ reps: num(s.reps), kg: num(s.kg) })) }))
      .filter((e) => e.name && e.sets.length);
    upsert(state.activities, {
      id: a?.id || uid(), type: 'gym', date: fd.get('date'), durationMin: num(fd.get('durationMin')),
      intensity: fd.get('intensity'), kcalOverride: num(fd.get('kcalOverride')), notes: fd.get('notes') || '', exercises,
    });
    toast('Gym session saved');
  }, () => remove(state.activities, a.id));
  const upd = () => {
    const fd = new FormData(form);
    const tmp = { type: 'gym', date: fd.get('date') || date, durationMin: num(fd.get('durationMin')), intensity: fd.get('intensity') };
    const vol = ex.reduce((s, e) => s + e.sets.reduce((t, x) => t + num(x.reps) * num(x.kg), 0), 0);
    $('#est').innerHTML = `Estimated burn: <b>${fmt(estimateKcal(tmp))} kcal</b> above resting${vol ? ` · volume ${fmt(vol)} kg` : ''}`;
  };
  form.addEventListener('input', upd); upd();
}

function recentFoods() {
  const seen = new Map();
  for (const f of [...state.foods].sort((x, y) => (y.date + y.id).localeCompare(x.date + x.id))) {
    const k = (f.name || '').trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, f);
    if (seen.size >= 12) break;
  }
  return [...seen.values()];
}
function defaultMeal() { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snack'; }
function foodForm(f, date) {
  const recent = f ? [] : recentFoods();
  const v = (k) => esc(f?.[k] ?? '');
  openSheet(`<form><h3>${f ? 'Edit' : 'Add'} Food</h3>
    <div class="photo-box">
      <button type="button" id="photoBtn" class="photo-btn">${svgIcon('camera')}Estimate from a photo</button>
      <input type="file" id="photoInput" accept="image/*" hidden>
      <div id="photoArea" hidden>
        <img id="photoPrev" alt="Your meal photo">
        <label class="f" style="margin:8px 0">Anything the photo doesn't show? (optional)<input id="photoNote" placeholder="e.g. half the rice left, extra fried egg"></label>
        <div class="row"><button type="button" id="photoRun" class="primary grow">Estimate again</button><button type="button" id="photoRetake">New photo</button></div>
        <div id="photoStatus" class="estimate" style="margin:8px 0 0"></div>
      </div>
    </div>
    ${recent.length ? `<div class="muted small" style="margin-bottom:6px">Recent (tap to fill)</div><div class="chips" style="margin-bottom:12px">${recent.map((r, i) => `<button type="button" class="chip" data-r="${i}">${esc(r.name)} · ${fmt(r.kcal)}</button>`).join('')}</div>` : ''}
    <label class="f">What did you eat?<input name="name" list="foodList" value="${v('name')}" placeholder="e.g. Chicken rice" required></label>
    <div class="two">
      <label class="f">Calories (kcal)<input type="number" name="kcal" inputmode="numeric" min="0" step="any" value="${v('kcal')}" required></label>
      <label class="f">Meal<select name="meal">${MEALS.map((m) => `<option ${m === (f?.meal || defaultMeal()) ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    </div>
    <div class="three">
      <label class="f">Protein (g)<input type="number" name="protein" inputmode="decimal" min="0" step="any" value="${v('protein')}"></label>
      <label class="f">Carbs (g)<input type="number" name="carbs" inputmode="decimal" min="0" step="any" value="${v('carbs')}"></label>
      <label class="f">Fat (g)<input type="number" name="fat" inputmode="decimal" min="0" step="any" value="${v('fat')}"></label>
    </div>
    <label class="f">Date<input type="date" name="date" value="${esc(f?.date || date)}" max="${todayStr()}" required></label>
    ${formActions(f)}</form>`);
  const form = wireForm((fd) => {
    const rec = { id: f?.id || uid(), date: fd.get('date'), name: (fd.get('name') || '').trim(), kcal: num(fd.get('kcal')), meal: fd.get('meal') };
    for (const k of ['protein', 'carbs', 'fat']) if (String(fd.get(k) || '').trim() !== '') rec[k] = num(fd.get(k));
    if (form.dataset.ai) rec.ai = form.dataset.ai;
    upsert(state.foods, rec);
    toast('Food saved');
  }, () => remove(state.foods, f.id));
  $('#sheetBody').querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
    const r = recent[+b.dataset.r]; form.name.value = r.name; form.kcal.value = r.kcal;
    for (const k of ['protein', 'carbs', 'fat']) form[k].value = r[k] ?? '';
  });
  form.name.addEventListener('change', () => {
    const r = recentFoods().find((x) => x.name.toLowerCase() === form.name.value.trim().toLowerCase());
    if (r && !form.kcal.value) { form.kcal.value = r.kcal; for (const k of ['protein', 'carbs', 'fat']) if (!form[k].value) form[k].value = r[k] ?? ''; }
  });
  wirePhoto(form);
}

/* ---------- Food photo estimate (Gemini API, your own key) ---------- */
const GEMINI_KEY = 'fitlog.geminiKey';      // stored only on this device, never in backups
const GEMINI_MODEL = 'fitlog.geminiModel';  // auto-detected model, cached
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const getGeminiKey = () => { try { return localStorage.getItem(GEMINI_KEY) || ''; } catch (e) { return ''; } };

function wirePhoto(form) {
  let image = null; // { b64, mime }
  const input = $('#photoInput'), area = $('#photoArea'), status = $('#photoStatus');
  $('#photoBtn').onclick = () => {
    if (!getGeminiKey()) {
      if (confirm('Photo estimates need a free Gemini API key (one-time setup in Settings). Open Settings now?')) { closeSheet(); view = 'settings'; render(); setTimeout(() => $('#aiCard')?.scrollIntoView(), 50); }
      return;
    }
    input.click();
  };
  $('#photoRetake').onclick = () => input.click();
  input.onchange = async () => {
    const file = input.files[0]; input.value = ''; if (!file) return;
    try {
      image = await shrinkImage(file, 1024);
      $('#photoPrev').src = 'data:' + image.mime + ';base64,' + image.b64;
      area.hidden = false; $('#photoBtn').hidden = true;
      run();
    } catch (e) { alert('Could not read that photo: ' + e.message); }
  };
  $('#photoRun').onclick = () => image && run();
  async function run() {
    const btn = $('#photoRun'); btn.disabled = true;
    status.innerHTML = 'Looking at your meal… (a few seconds)';
    try {
      const r = await estimateFoodPhoto(image, $('#photoNote').value.trim());
      form.name.value = r.name || 'Meal';
      form.kcal.value = Math.round(r.kcal || 0);
      form.protein.value = r.protein_g != null ? Math.round(r.protein_g) : '';
      form.carbs.value = r.carbs_g != null ? Math.round(r.carbs_g) : '';
      form.fat.value = r.fat_g != null ? Math.round(r.fat_g) : '';
      form.dataset.ai = r.model;
      const items = (r.items || []).map((i) => `<li>${esc(i.name)}${i.portion ? ` <span class="muted">(${esc(i.portion)})</span>` : ''}: ${fmt(i.kcal || 0)} kcal</li>`).join('');
      status.innerHTML = `<b>AI estimate: ${fmt(r.kcal || 0)} kcal</b>${r.confidence ? ` · confidence ${esc(r.confidence)}` : ''}
        ${items ? `<ul class="items">${items}</ul>` : ''}${r.notes ? `<div class="small">${esc(r.notes)}</div>` : ''}
        <div class="small muted" style="margin-top:4px">Check the numbers below and fix anything before saving. Portions are guesses.</div>`;
    } catch (e) {
      status.innerHTML = `<b>Couldn't estimate.</b> ${esc(e.message)}`;
    } finally { btn.disabled = false; }
  }
}

function shrinkImage(file, maxSide) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res({ mime: 'image/jpeg', b64: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('unsupported image format (try a JPEG or take the photo in the app)')); };
    img.src = url;
  });
}

// Pick the newest general "Flash" model this key can use, then Flash-Lite as a fallback.
async function geminiCandidates(key, forceRefresh) {
  const manual = (state.settings.geminiModel || '').trim();
  if (manual) return [manual];
  let cached = null; try { cached = JSON.parse(localStorage.getItem(GEMINI_MODEL) || 'null'); } catch (e) { /* ignore */ }
  if (!forceRefresh && cached && cached.list && Date.now() - cached.at < 7 * 864e5) return cached.list;
  const r = await fetch(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
  if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? 'Google rejected the API key. Check it in Settings.' : `Gemini error ${r.status}`);
  const models = ((await r.json()).models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n));
  const ver = (n) => parseFloat(n.match(/gemini-([\d.]+)/)[1]);
  const sortV = (a, b) => ver(b) - ver(a);
  const list = [...models.filter((n) => !n.endsWith('-lite')).sort(sortV), ...models.filter((n) => n.endsWith('-lite')).sort(sortV)].slice(0, 4);
  if (!list.length) list.push('gemini-flash-latest');
  try { localStorage.setItem(GEMINI_MODEL, JSON.stringify({ at: Date.now(), list })); } catch (e) { /* ignore */ }
  return list;
}

const FOOD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Short name for the whole meal, e.g. "Khao man gai with soup"' },
    items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      name: { type: 'STRING' }, portion: { type: 'STRING' }, kcal: { type: 'NUMBER' },
      protein_g: { type: 'NUMBER' }, carbs_g: { type: 'NUMBER' }, fat_g: { type: 'NUMBER' } }, required: ['name', 'kcal'] } },
    kcal: { type: 'NUMBER' }, protein_g: { type: 'NUMBER' }, carbs_g: { type: 'NUMBER' }, fat_g: { type: 'NUMBER' },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    notes: { type: 'STRING', description: 'One short sentence on assumptions, e.g. cooking oil, hidden sauces' },
  },
  required: ['name', 'items', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
};
function foodPrompt(note) {
  return `You estimate the nutrition of a meal from one photo for a personal calorie tracker.
Identify each food and drink visible, estimate its portion (use plate, bowl, cutlery and hands for scale), and estimate calories, protein, carbs and fat for that portion.
Count cooking oil, sauces and sugary drinks, which people often forget. The person usually eats Thai and Southeast Asian food, so consider street-food and restaurant portions.
If the photo is not food, return kcal 0, an empty items list, confidence "low", and say so in notes.
Totals must equal the sum of the items. Answer only with JSON.${note ? `\nThe person adds: "${note.replace(/"/g, "'")}"` : ''}`;
}
async function estimateFoodPhoto(image, note) {
  const key = getGeminiKey();
  if (!key) throw new Error('Add your Gemini API key in Settings first.');
  if (!navigator.onLine) throw new Error('You are offline. Type the calories in by hand for now.');
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const models = await geminiCandidates(key, attempt > 0);
    for (const model of models) {
      for (const useSchema of [true, false]) {
        const body = {
          contents: [{ role: 'user', parts: [{ text: foodPrompt(note) }, { inline_data: { mime_type: image.mime, data: image.b64 } }] }],
          generationConfig: useSchema ? { responseMimeType: 'application/json', responseSchema: FOOD_SCHEMA } : { responseMimeType: 'application/json' },
        };
        let r;
        try {
          r = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
          });
        } catch (e) { throw new Error('Could not reach Google. Check your connection.'); }
        if (r.ok) {
          const j = await r.json();
          const parts = j.candidates?.[0]?.content?.parts || [];
          const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
          const m = text.match(/\{[\s\S]*\}/);
          if (!m) { lastErr = new Error(j.promptFeedback?.blockReason ? 'Google blocked this photo.' : 'The AI gave no answer. Try again.'); break; }
          const out = JSON.parse(m[0]);
          out.model = model;
          return out;
        }
        const errText = await r.text();
        if (r.status === 400 && useSchema && /schema|response_?mime|generation_?config/i.test(errText)) continue; // retry without schema
        if (r.status === 400 && /API key/i.test(errText)) throw new Error('Google rejected the API key. Check it in Settings.');
        if (r.status === 403) throw new Error('This API key is not allowed to use Gemini. Create a key in Google AI Studio.');
        lastErr = new Error(r.status === 429 ? 'Free daily limit reached for now. Try again later or type calories by hand.'
          : r.status >= 500 ? 'Google is busy right now. Try again in a minute.'
            : `Gemini error ${r.status}: ${errText.slice(0, 160)}`);
        break; // try the next model
      }
    }
    if (state.settings.geminiModel) break;
  }
  throw lastErr || new Error('No Gemini model available for this key.');
}

function weightForm(item, date) {
  const d0 = item?.date || date || todayStr();
  const wRec = item ? state.weights.find((x) => x.date === d0) : null;
  const mRec = item ? state.measurements.find((x) => x.date === d0) : null;
  const lastM = [...state.measurements].sort((x, y) => y.date.localeCompare(x.date))[0];
  openSheet(`<form><h3>${item ? 'Edit' : 'Log'} Body</h3>
    <label class="f">Weight (kg)<input type="number" name="kg" inputmode="decimal" min="20" max="400" step="any" value="${esc(item ? (wRec?.kg ?? '') : weightOn(d0))}"></label>
    <div class="muted small" style="margin:-4px 0 8px">Measurements (optional). Measure at the same time of day, e.g. in the morning before eating.</div>
    <div class="two">${MEASURES.map(([k, l, u]) => `<label class="f">${l} (${u})<input type="number" name="${k}" inputmode="decimal" min="0" step="any" value="${esc(mRec?.[k] ?? '')}" placeholder="${lastM?.[k] ? 'last ' + fmt1(lastM[k]) : ''}"></label>`).join('')}</div>
    <label class="f">Date<input type="date" name="date" value="${esc(d0)}" max="${todayStr()}" required></label>
    ${formActions(item)}</form>`);
  wireForm((fd) => {
    const date = fd.get('date'), kg = num(fd.get('kg'));
    const m = { id: mRec?.id || uid(), date };
    let anyM = false;
    for (const [k] of MEASURES) { const v = num(fd.get(k)); if (v > 0) { m[k] = v; anyM = true; } }
    if (!(kg > 0) && !anyM) { alert('Enter your weight or at least one measurement.'); return false; }
    // one weight and one measurement set per day; moving the date moves both
    state.weights = state.weights.filter((x) => x.date !== date && x !== wRec);
    state.measurements = state.measurements.filter((x) => x.date !== date && x !== mRec);
    if (kg > 0) state.weights.push({ id: wRec?.id || uid(), date, kg });
    if (anyM) state.measurements.push(m);
    const latest = [...state.weights].sort((x, y) => y.date.localeCompare(x.date))[0];
    if (latest) state.profile.weightKg = latest.kg;
    toast('Saved');
  }, () => {
    state.weights = state.weights.filter((x) => x !== wRec);
    state.measurements = state.measurements.filter((x) => x !== mRec);
  });
}
function upsert(arr, rec) { const i = arr.findIndex((x) => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.push(rec); }
function remove(arr, id) { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); }

function refreshDatalists() {
  const names = new Set();
  state.activities.filter((a) => a.type === 'gym').forEach((a) => (a.exercises || []).forEach((e) => names.add(e.name)));
  COMMON_EXERCISES.forEach((n) => names.add(n));
  $('#exList').innerHTML = [...names].map((n) => `<option value="${esc(n)}">`).join('');
  $('#foodList').innerHTML = recentFoods().map((f) => `<option value="${esc(f.name)}">`).join('');
}

/* ---------- History ---------- */
function renderHistory() {
  $('#title').textContent = 'History';
  const filters = [['all', 'All'], ...Object.entries(TYPES).map(([k, t]) => [k, t.label]), ['food', 'Food'], ['weight', 'Body']];
  const items = [];
  if (histFilter === 'all' || TYPES[histFilter]) state.activities.filter((a) => histFilter === 'all' || a.type === histFilter).forEach((a) => items.push({ date: a.date, html: actRow(a), k: '0' + a.id }));
  if (histFilter === 'all' || histFilter === 'food') state.foods.forEach((f) => items.push({ date: f.date, html: foodRow(f), k: '1' + f.id }));
  if (histFilter === 'all' || histFilter === 'weight') {
    state.weights.forEach((w) => items.push({ date: w.date, html: weightRow(w), k: '2' + w.id }));
    state.measurements.forEach((m) => items.push({ date: m.date, html: measureRow(m), k: '3' + m.id }));
  }
  items.sort((x, y) => y.date.localeCompare(x.date) || x.k.localeCompare(y.k));
  let html = `<div class="chips" style="margin-bottom:8px">${filters.map(([k, l]) => `<button class="chip ${k === histFilter ? 'on' : ''}" data-filter="${k}">${l}</button>`).join('')}</div>`;
  if (!items.length) html += '<div class="card empty">Nothing here yet. Tap + to log something.</div>';
  let lastDate = null, open = false, shown = 0;
  for (const it of items) {
    if (shown++ >= 300) break;
    if (it.date !== lastDate) {
      if (open) html += '</ul></section>';
      const s = histFilter === 'all' ? dayStats(it.date) : null;
      html += `<div class="daygroup">${esc(fmtDate(it.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}${s && s.foods.length ? ` · ${s.balance > 0 ? '+' : ''}${fmt(s.balance)} kcal` : ''}</div><section class="card" style="padding:4px 14px"><ul class="list">`;
      lastDate = it.date; open = true;
    }
    html += it.html;
  }
  if (open) html += '</ul></section>';
  $('#view').innerHTML = html;
  $('#view').querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { histFilter = b.dataset.filter; render(); });
  bindRows($('#view'));
}

/* ---------- Progress ---------- */
function weekStart(dateStr) { const d = parseYmd(dateStr); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); }
function renderProgress() {
  $('#title').textContent = 'Progress';
  const today = todayStr();
  const from7 = addDays(today, -6);
  const last7 = state.activities.filter((a) => a.date >= from7 && a.date <= today);
  const mins = last7.reduce((s, a) => s + num(a.durationMin), 0);
  const runKm = last7.filter((a) => a.type === 'run').reduce((s, a) => s + num(a.distanceKm), 0);
  const trekKm = last7.filter((a) => a.type === 'trek').reduce((s, a) => s + num(a.distanceKm), 0);
  const byType = Object.keys(TYPES).map((k) => `<span>${tile(k)}${last7.filter((a) => a.type === k).length}</span>`).join('');

  let html = `<section class="card"><h2>Last 7 days</h2><div class="stats">
    <div class="stat"><div class="v">${last7.length}</div><div class="muted small">Workouts</div></div>
    <div class="stat"><div class="v">${fmtDuration(mins)}</div><div class="muted small">Active time</div></div>
    <div class="stat"><div class="v">${fmt1(runKm)} km</div><div class="muted small">Running</div></div>
    <div class="stat"><div class="v">${fmt1(trekKm)} km</div><div class="muted small">Trekking</div></div>
  </div><div class="typecounts">${byType}</div></section>`;

  // Weekly active minutes, last 8 weeks (single series)
  const thisWeek = weekStart(today);
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i), we = addDays(ws, 6);
    weeks.push({ ws, min: state.activities.filter((a) => a.date >= ws && a.date <= we).reduce((s, a) => s + num(a.durationMin), 0) });
  }
  html += `<section class="card"><h2>Active minutes per week</h2>${barChart(weeks)}</section>`;

  // Calorie balance last 7 days
  const rows = [];
  for (let i = 0; i < 7; i++) { const d = addDays(today, -i); const s = dayStats(d); if (s.foods.length) rows.push([d, s]); }
  html += `<section class="card"><h2>Calorie balance (days with food logged)</h2>${rows.length ? `<table class="t"><tr><th>Day</th><th class="r">Eaten</th><th class="r">Burned</th><th class="r">Balance</th></tr>
    ${rows.map(([d, s]) => `<tr><td>${esc(fmtDate(d))}</td><td class="r">${fmt(s.eaten)}</td><td class="r">${fmt(s.burned)}</td><td class="r ${s.balance > 0 ? 'pos' : 'neg'}">${s.balance > 0 ? '+' : ''}${fmt(s.balance)}</td></tr>`).join('')}</table>
    <p class="muted small" style="margin:8px 0 0">About 7,700 kcal of total deficit ≈ 1 kg of body fat. Total here: ${fmt(rows.reduce((t, [, s]) => t + s.balance, 0))} kcal.</p>` : '<div class="empty">Log food to see your balance.</div>'}</section>`;

  html += goalCard(false);
  // Weight
  const ws = [...state.weights].sort((x, y) => x.date.localeCompare(y.date)).slice(-30);
  html += `<section class="card"><h2>Body weight (kg)</h2>${ws.length >= 2 ? lineChart(ws) : ws.length ? `<div>${fmt1(ws[0].kg)} kg on ${esc(fmtDate(ws[0].date))}. Log again to see a trend.</div>` : '<div class="empty">Log your weight to see a trend.</div>'}</section>`;

  // Body measurements: first vs latest
  const msr = [...state.measurements].sort((x, y) => x.date.localeCompare(y.date));
  const mrows = MEASURES.map(([k, l, u]) => {
    const withK = msr.filter((m) => m[k] > 0);
    if (!withK.length) return '';
    const first = withK[0], last = withK[withK.length - 1], diff = last[k] - first[k];
    return `<tr><td>${l}</td><td class="r">${fmt1(first[k])}</td><td class="r"><b>${fmt1(last[k])}</b></td><td class="r ${diff < 0 ? 'neg' : diff > 0 ? 'pos' : ''}">${withK.length > 1 ? (diff > 0 ? '+' : '') + fmt1(diff) + (u === '%' ? '' : '') : '–'}</td></tr>`;
  }).join('');
  html += `<section class="card"><h2>Body measurements</h2>${mrows ? `<table class="t"><tr><th></th><th class="r">First</th><th class="r">Latest</th><th class="r">Change</th></tr>${mrows}</table>
    <p class="muted small" style="margin:8px 0 0">cm, body fat in %. Since ${esc(fmtDate(msr[0].date, { day: 'numeric', month: 'short', year: 'numeric' }))}. A shrinking waist while your weight holds steady usually means you're losing fat and gaining muscle.</p>`
    : '<div class="empty">Tap Body on the Today screen to add waist, hips and other measurements. Shape changes often show here before the scale moves.</div>'}</section>`;

  // Gym bests
  const best = new Map();
  for (const a of state.activities.filter((x) => x.type === 'gym')) for (const e of a.exercises || []) {
    const k = e.name.trim().toLowerCase();
    const b = best.get(k) || { name: e.name, maxKg: 0, e1rm: 0, last: '' , maxReps: 0};
    for (const s of e.sets) {
      b.maxKg = Math.max(b.maxKg, s.kg); b.maxReps = Math.max(b.maxReps, s.reps);
      if (s.kg > 0 && s.reps > 0 && s.reps <= 12) b.e1rm = Math.max(b.e1rm, s.kg * (1 + s.reps / 30)); // Epley
    }
    if (a.date > b.last) b.last = a.date;
    best.set(k, b);
  }
  const bl = [...best.values()].sort((x, y) => y.last.localeCompare(x.last));
  html += `<section class="card"><h2>Gym personal bests</h2>${bl.length ? `<table class="t"><tr><th>Exercise</th><th class="r">Heaviest</th><th class="r">Est. 1-rep max</th></tr>
    ${bl.map((b) => `<tr><td>${esc(b.name)}<div class="muted small">last done: ${esc(fmtDate(b.last, { day: 'numeric', month: 'short' }))}</div></td><td class="r">${b.maxKg ? fmt1(b.maxKg) + ' kg' : b.maxReps + ' reps'}</td><td class="r">${b.e1rm ? fmt1(b.e1rm) + ' kg' : '–'}</td></tr>`).join('')}</table>` : '<div class="empty">Log a gym session to see your bests.</div>'}</section>`;

  $('#view').innerHTML = html;
}
function barChart(weeks) {
  const W = 320, H = 150, L = 30, B = 22, T = 10;
  const max = Math.max(60, ...weeks.map((w) => w.min));
  const step = max > 600 ? 200 : max > 300 ? 100 : 60;
  const top = Math.ceil(max / step) * step;
  const bw = (W - L) / weeks.length;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  weeks.forEach((w, i) => {
    const x = L + i * bw + bw * 0.2, wd = bw * 0.6, h = (H - T - B) - (y(w.min) - T);
    const label = parseYmd(w.ws).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    if (w.min > 0) {
      const r = Math.min(4, wd / 2, h);
      const y0 = y(0), y1 = y(w.min);
      g += `<path class="bar" d="M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + wd - r} Q${x + wd},${y1} ${x + wd},${y1 + r} V${y0} Z"><title>Week of ${label}: ${Math.round(w.min)} min</title></path>`;
    }
    if (i % 2 === 1 || weeks.length <= 4) g += `<text x="${x + wd / 2}" y="${H - 6}" text-anchor="middle">${label}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Active minutes per week, last 8 weeks">${g}</svg><div class="muted small">Weeks start Monday. Tap a bar for the exact number.</div>`;
}
function lineChart(ws) {
  const W = 320, H = 150, L = 34, B = 22, T = 10, R = 8;
  const vals = ws.map((w) => w.kg);
  const tgt = state.profile.targetKg > 0 ? state.profile.targetKg : null;
  let lo = Math.floor(Math.min(...vals, ...(tgt ? [tgt] : [])) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = parseYmd(ws[0].date).getTime(), t1 = parseYmd(ws[ws.length - 1].date).getTime();
  const x = (d) => L + (W - L - R) * (t1 === t0 ? 0.5 : (parseYmd(d).getTime() - t0) / (t1 - t0));
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let g = '';
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  for (let v = lo; v <= hi; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  if (tgt) g += `<line class="target" x1="${L}" x2="${W - R}" y1="${y(tgt)}" y2="${y(tgt)}"/><text x="${W - R}" y="${y(tgt) - 4}" text-anchor="end">target ${fmt1(tgt)}</text>`;
  g += `<polyline class="line" points="${ws.map((w) => `${x(w.date)},${y(w.kg)}`).join(' ')}"/>`;
  g += ws.map((w) => `<circle class="dot" cx="${x(w.date)}" cy="${y(w.kg)}" r="4"><title>${esc(fmtDate(w.date))}: ${fmt1(w.kg)} kg</title></circle>`).join('');
  const lbl = (d, anchor, xx) => `<text x="${xx}" y="${H - 6}" text-anchor="${anchor}">${parseYmd(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</text>`;
  g += lbl(ws[0].date, 'start', L) + lbl(ws[ws.length - 1].date, 'end', W - R);
  const diff = vals[vals.length - 1] - vals[0];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Body weight trend">${g}</svg><div class="muted small">Change: ${diff > 0 ? '+' : ''}${fmt1(diff)} kg since ${esc(fmtDate(ws[0].date))}.</div>`;
}

/* ---------- Settings, profile & backup ---------- */
function renderSettings() {
  $('#title').textContent = 'Settings';
  const p = state.profile, st = state.settings;
  const last = st.lastBackup ? `${new Date(st.lastBackup).toLocaleString()} (${st.lastBackupWhere || ''})` : 'never';
  $('#view').innerHTML = `
  <form class="card" id="profileForm"><h2>Your profile (used for calorie estimates)</h2>
    <div class="two">
      <label class="f">Sex<select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
      <label class="f">Age<input type="number" name="age" inputmode="numeric" min="10" max="100" value="${esc(p.age)}" required></label>
      <label class="f">Height (cm)<input type="number" name="heightCm" inputmode="decimal" min="100" max="250" step="any" value="${esc(p.heightCm)}" required></label>
      <label class="f">Weight (kg)<input type="number" name="weightKg" inputmode="decimal" min="20" max="400" step="any" value="${esc(weightOn(todayStr()))}" required></label>
    </div>
    <label class="f">Daily life, not counting workouts<select name="activity">${ACTIVITY_LEVELS.map(([v, l]) => `<option value="${v}" ${v === p.activity ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">Goal<select name="goal">${GOALS.map(([v, l]) => `<option value="${v}" ${v === num(p.goal) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <div class="two">
      <label class="f">Target weight (kg)<input type="number" name="targetKg" inputmode="decimal" min="20" max="400" step="any" value="${p.targetKg > 0 ? esc(p.targetKg) : ''}" placeholder="optional"></label>
      <label class="f">Protein goal<select name="proteinPerKg">${PROTEIN_LEVELS.map(([v, l]) => `<option value="${v}" ${v === num(p.proteinPerKg || 1.6) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <p class="muted small" id="bmrInfo"></p>
    <button class="primary" type="submit" style="width:100%">Save profile</button>
  </form>

  <section class="card" id="backupCard"><h2>Backup</h2>
    <p class="muted small" style="margin-top:0">Last backup: ${esc(last)}</p>
    <h2 style="margin-top:14px">Google Drive</h2>
    ${st.clientId ? `<div class="row" style="flex-wrap:wrap">
        <button class="primary" id="driveBackup">Back up to Drive</button>
        <button id="driveRestore">Restore from Drive</button></div>
        <p class="muted small">Saves "${DRIVE_FILE}" in your Drive. After you back up once, later changes are also saved automatically while the app stays open.</p>`
      : `<p class="muted small">Needs a free Google OAuth Client ID (one-time setup, see the README). Until then, use the backup file below.</p>`}
    <details ${st.clientId ? '' : 'open'}><summary class="muted small">Google Client ID</summary>
      <div class="row" style="margin-top:8px"><input id="clientId" class="grow" placeholder="xxxx.apps.googleusercontent.com" value="${esc(st.clientId)}"><button id="saveClient">Save</button></div>
    </details>
    <h2 style="margin-top:16px">Backup file (works with no setup)</h2>
    <div class="row" style="flex-wrap:wrap"><button id="exportBtn">Save backup file</button><button id="importBtn">Restore from file</button></div>
    <p class="muted small">On a phone, "Save backup file" opens the share sheet so you can pick Google Drive, LINE, email, etc.</p>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
  </section>

  <section class="card" id="aiCard"><h2>Food photo estimates (Gemini AI)</h2>
    <p class="muted small" style="margin-top:0">Take a photo of your meal and get calories, protein, carbs and fat. Uses your own free API key from Google AI Studio (see README). The key stays on this phone and is not included in backups.</p>
    <div class="row"><input id="geminiKey" class="grow" type="password" autocomplete="off" placeholder="Paste Gemini API key" value="${esc(getGeminiKey())}"><button id="saveGemini">Save</button></div>
    <p class="small" style="margin:8px 0 0">${getGeminiKey() ? '✓ Key saved.' : 'No key yet.'} ${(() => { try { const c = JSON.parse(localStorage.getItem(GEMINI_MODEL) || 'null'); return c?.list?.[0] ? `Model in use: ${esc(state.settings.geminiModel || c.list[0])}.` : ''; } catch (e) { return ''; } })()}</p>
    <details style="margin-top:8px"><summary class="muted small">Advanced: choose a model</summary>
      <label class="f" style="margin-top:8px">Model ID (leave blank to pick the newest Flash model automatically)<input id="geminiModel" placeholder="auto" value="${esc(st.geminiModel || '')}"></label></details>
    <p class="muted small">Privacy: on Google's free tier, photos and prompts you send may be used by Google to improve its products and may be seen by human reviewers. Don't photograph anything private.</p>
  </section>

  <section class="card"><h2>Data</h2>
    <p class="muted small" style="margin-top:0">${state.activities.length} workouts, ${state.foods.length} food entries, ${state.weights.length} weigh-ins, ${state.measurements.length} measurement sets stored on this device.</p>
    <button class="danger" id="wipe">Delete all data on this device</button>
  </section>
  <p class="muted small" style="text-align:center">FitLog · calorie numbers are estimates, not medical advice.</p>`;

  const pf = $('#profileForm');
  const info = () => {
    const fd = new FormData(pf);
    const tmp = { sex: fd.get('sex'), age: num(fd.get('age')), heightCm: num(fd.get('heightCm')), weightKg: num(fd.get('weightKg')) };
    const b = 10 * tmp.weightKg + 6.25 * tmp.heightCm - 5 * tmp.age + (tmp.sex === 'female' ? -161 : 5);
    const base = b * num(fd.get('activity'));
    $('#bmrInfo').textContent = `Resting burn (BMR) ≈ ${fmt(b)} kcal/day. With daily life ≈ ${fmt(base)} kcal/day before workouts. Daily target ≈ ${fmt(base + num(fd.get('goal')))} kcal + workout calories. Protein ≈ ${fmt(num(fd.get('proteinPerKg')) * tmp.weightKg)} g/day.`;
  };
  pf.addEventListener('input', info); info();
  pf.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(pf);
    const kg = num(fd.get('weightKg'));
    const targetKg = num(fd.get('targetKg'));
    if (targetKg !== num(state.profile.targetKg)) { // new target: progress starts from today's weight
      state.profile.startKg = targetKg > 0 ? kg : 0; state.profile.startDate = targetKg > 0 ? todayStr() : '';
    }
    Object.assign(state.profile, { set: true, sex: fd.get('sex'), age: num(fd.get('age')), heightCm: num(fd.get('heightCm')), activity: num(fd.get('activity')), goal: num(fd.get('goal')), targetKg, proteinPerKg: num(fd.get('proteinPerKg')) || 1.6 });
    if (Math.abs(kg - weightOn(todayStr())) > 0.001) {
      state.weights = state.weights.filter((w) => w.date !== todayStr());
      state.weights.push({ id: uid(), date: todayStr(), kg });
      state.profile.weightKg = kg;
    }
    save(); toast('Profile saved'); render();
  };
  $('#saveGemini').onclick = () => {
    const k = $('#geminiKey').value.trim();
    try { if (k) localStorage.setItem(GEMINI_KEY, k); else localStorage.removeItem(GEMINI_KEY); localStorage.removeItem(GEMINI_MODEL); } catch (e) { /* ignore */ }
    state.settings.geminiModel = $('#geminiModel').value.trim(); save();
    toast(k ? 'Gemini key saved' : 'Gemini key removed'); render();
  };
  $('#saveClient').onclick = () => { state.settings.clientId = $('#clientId').value.trim(); save(); preloadGis(); toast('Client ID saved'); render(); };
  $('#exportBtn').onclick = exportFile;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = importFile;
  $('#wipe').onclick = () => {
    if (confirm('Delete ALL workouts, food and weight entries on this device? Make a backup first if unsure.') && confirm('Really delete everything?')) {
      const keep = state.settings.clientId; state = fresh(); state.settings.clientId = keep; save(); render(); toast('All data deleted');
    }
  };
  if (st.clientId) {
    $('#driveBackup').onclick = () => driveBackup(false);
    $('#driveRestore').onclick = driveRestore;
  }
}

function backupJson() { return JSON.stringify({ app: 'FitLog', exportedAt: new Date().toISOString(), data: state }, null, 1); }
function markBackup(where) { state.settings.lastBackup = new Date().toISOString(); state.settings.lastBackupWhere = where; localStorage.setItem(KEY, JSON.stringify(state)); }
async function exportFile() {
  const name = `fitlog-backup-${todayStr()}.json`;
  const blob = new Blob([backupJson()], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'FitLog backup' });
      markBackup('file'); render(); return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement('a'); aEl.href = url; aEl.download = name; document.body.appendChild(aEl); aEl.click(); aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  markBackup('file'); render();
}
function parseBackup(text) {
  const obj = JSON.parse(text);
  const data = obj && obj.data ? obj.data : obj;
  if (!data || !data.version || !Array.isArray(data.activities)) throw new Error('This file is not a FitLog backup.');
  return normalize(data);
}
function restoreFrom(data, where) {
  const n = `${data.activities.length} workouts, ${data.foods.length} food entries, ${data.weights.length} weigh-ins`;
  if (!confirm(`Replace the data on this device with the backup (${n}, saved ${new Date(data.updatedAt).toLocaleString()})?`)) return;
  const keepClient = state.settings.clientId;
  state = data; if (!state.settings.clientId) state.settings.clientId = keepClient;
  localStorage.setItem(KEY, JSON.stringify(state));
  markBackup(where); render(); toast('Backup restored');
}
async function importFile(e) {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { restoreFrom(parseBackup(await f.text()), 'file'); } catch (err) { alert('Could not restore: ' + err.message); }
}

/* ---------- Google Drive (Google Identity Services + Drive REST, scope drive.file) ---------- */
let gisLoading = null, tokenClient = null, accessToken = null, tokenExpiry = 0, pendingToken = null;
function preloadGis() {
  if (!state.settings.clientId || !navigator.onLine) return Promise.resolve();
  if (!gisLoading) gisLoading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = () => { gisLoading = null; rej(new Error('Could not load Google sign-in. Are you online?')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}
function initTokenClient() {
  if (tokenClient && tokenClient._cid === state.settings.clientId) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.settings.clientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (r) => {
      if (r.error) { pendingToken?.rej(new Error(r.error_description || r.error)); return; }
      accessToken = r.access_token; tokenExpiry = Date.now() + (r.expires_in || 3600) * 1000;
      pendingToken?.res(accessToken);
    },
    error_callback: (e) => pendingToken?.rej(new Error(e.type === 'popup_closed' ? 'Sign-in was closed.' : (e.message || e.type))),
  });
  tokenClient._cid = state.settings.clientId;
}
async function getToken(interactive) {
  if (accessToken && Date.now() < tokenExpiry - 60000) return accessToken;
  if (!interactive) return null;
  if (!(window.google && google.accounts && google.accounts.oauth2)) {
    await preloadGis();
    toast('Google sign-in is ready. Tap the button again.');
    return null; // a popup needs a fresh tap, or browsers block it
  }
  initTokenClient();
  return new Promise((res, rej) => { pendingToken = { res, rej }; tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' }); });
}
async function driveFetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + accessToken, ...(opts.headers || {}) } });
  if (r.status === 401) { accessToken = null; throw new Error('Google sign-in expired. Tap the button again.'); }
  if (!r.ok) throw new Error(`Google Drive error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
async function findDriveFile() {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`);
  return (await r.json()).files?.[0] || null;
}
let backingUp = false;
async function driveBackup(silent) {
  if (backingUp) return;
  try {
    const tok = await getToken(!silent); if (!tok) return;
    backingUp = true;
    const body = backupJson();
    const existing = await findDriveFile();
    if (existing) {
      await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    } else {
      const boundary = 'fitlog' + Math.random().toString(36).slice(2);
      const meta = { name: DRIVE_FILE, mimeType: 'application/json' };
      const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
      await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart });
    }
    markBackup('Google Drive');
    if (!silent) { toast('Backed up to Google Drive ✓'); if (view === 'settings') render(); }
  } catch (e) {
    if (!silent) alert('Backup failed: ' + e.message);
  } finally { backingUp = false; }
}
async function driveRestore() {
  try {
    const tok = await getToken(true); if (!tok) return;
    const f = await findDriveFile();
    if (!f) { alert('No FitLog backup found in your Google Drive yet.'); return; }
    const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`);
    restoreFrom(parseBackup(await r.text()), 'Google Drive');
  } catch (e) { alert('Restore failed: ' + e.message); }
}
let autoTimer = null;
function scheduleAutoBackup() {
  if (!accessToken) return; // only after you've signed in this session
  clearTimeout(autoTimer); autoTimer = setTimeout(() => driveBackup(true), 8000);
}

/* ---------- boot ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden && curDate > todayStr()) curDate = todayStr(); if (!document.hidden) render(); });
preloadGis().catch(() => {});
render();
