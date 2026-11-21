// 跨设备同步：本机 localStorage 整包快照 ↔ 中转 ↔ Supabase（pvz_sync 表）
import { showDialog, closeDialog, toast, escapeHtml } from './ui.js';

const STATE_KEY = 'word-garden-sync-v1';
const RELAY = 'https://lz-sync.pages.dev/?p=';
const SUPABASE_URL = 'https://ruscbaukapxxlzwburre.supabase.co';
const PUBLISHABLE = 'sb_publishable_XSUF6UfFcymamNqBdJwWkQ_YPieFolG';
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const SYNC_KEYS = [
  'word-garden-progress-v1',
  'word-garden-students-v1',
  'word-garden-srs-v1',
  'word-garden-ranges-v1',
  'word-garden-custom-units-v1',
  'word-garden-book',
  'word-garden-mode',
  'word-garden-zombie-speed',
];
const DEBOUNCE_MS = 1500;

const rawSet = Storage.prototype.setItem;
const rawGet = Storage.prototype.getItem;
let timer = 0;
let busy = false;
let pending = false;
let lastError = '';

function readState() {
  try {
    return JSON.parse(rawGet.call(localStorage, STATE_KEY) || 'null') || null;
  } catch {
    return null;
  }
}

function writeState(state) {
  if (state) rawSet.call(localStorage, STATE_KEY, JSON.stringify(state));
  else localStorage.removeItem(STATE_KEY);
}

export function syncState() {
  return readState();
}

export function syncEnabled() {
  return !!readState()?.code;
}

function randomCode() {
  const bytes = new Uint8Array(25);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function snapshot() {
  const data = {};
  for (const key of SYNC_KEYS) {
    const raw = rawGet.call(localStorage, key);
    if (raw !== null) data[key] = raw;
  }
  return data;
}

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asList(raw) {
  const v = parse(raw);
  return Array.isArray(v) ? v : [];
}

// 三方合并：上次同步的基线 base 里有、但另一端没有的条目视为已删除
function idMerge(local, remote, base, combine = (l, r) => ({ ...r, ...l })) {
  const L = new Map(local.filter((x) => x && x.id != null).map((x) => [x.id, x]));
  const R = new Map(remote.filter((x) => x && x.id != null).map((x) => [x.id, x]));
  const B = new Set(base.filter((x) => x && x.id != null).map((x) => x.id));
  const out = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) out.push(combine(l, r));
    else if (!B.has(id)) out.push(l || r);
  }
  return out;
}

function mergeProgress(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    const cur = out[k];
    if (!cur || (v?.stars || 0) > (cur.stars || 0) || (v?.best || 0) > (cur.best || 0)) out[k] = { ...(cur || {}), ...v, stars: Math.max(v?.stars || 0, cur?.stars || 0) };
  }
  return out;
}

function mergeStudentPair(l, r) {
  const seen = new Set();
  const history = [...(l.history || []), ...(r.history || [])]
    .filter((h) => {
      const key = `${h.at}|${h.unitId}|${h.diff}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => (y.at || 0) - (x.at || 0))
    .slice(0, 300);
  return { ...r, ...l, progress: mergeProgress(l.progress, r.progress), history };
}

function mergeStudents(local, remote, base) {
  const sl = parse(local) || { list: [], active: null };
  const sr = parse(remote) || { list: [], active: null };
  const sb = parse(base) || { list: [] };
  const list = idMerge(sl.list || [], sr.list || [], sb.list || [], mergeStudentPair);
  const active = list.some((s) => s.id === sl.active) ? sl.active : null;
  return JSON.stringify({ list, active: active || sr.active || null });
}

function mergeSrs(a, b) {
  const da = parse(a) || {};
  const db = parse(b) || {};
  const out = { ...da };
  for (const [en, rec] of Object.entries(db)) {
    const cur = out[en];
    if (!cur || (rec?.last || 0) > (cur.last || 0)) out[en] = rec;
  }
  return JSON.stringify(out);
}

function mergeValue(key, local, remote, base) {
  if (local == null) return remote;
  if (remote == null) return local;
  if (local === remote) return local;
  if (key === 'word-garden-progress-v1') return JSON.stringify(mergeProgress(parse(local), parse(remote)));
  if (key === 'word-garden-students-v1') return mergeStudents(local, remote, base);
  if (key === 'word-garden-srs-v1') return mergeSrs(local, remote);
  if (key === 'word-garden-ranges-v1' || key === 'word-garden-custom-units-v1') {
    return JSON.stringify(idMerge(asList(local), asList(remote), asList(base)));
  }
  return local;
}

function mergeSnapshots(local, remote, base = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const v = mergeValue(key, local[key], remote[key], base[key]);
    if (v != null) out[key] = v;
  }
  return out;
}

function applyData(data) {
  for (const key of SYNC_KEYS) {
    if (data[key] != null && data[key] !== rawGet.call(localStorage, key)) rawSet.call(localStorage, key, data[key]);
  }
}

function changed(before, after) {
  return SYNC_KEYS.some((k) => before[k] !== after[k]);
}

async function relay(fn, body) {
  const path = `/rest/v1/rpc/pvz_sync_${fn}`;
  const res = await fetch(RELAY + encodeURIComponent(path), {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE,
      Authorization: `Bearer ${PUBLISHABLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(text.includes('40001') ? 'conflict' : `HTTP ${res.status}`);
    err.conflict = text.includes('40001');
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function setStatus(status, extra = {}) {
  const state = readState() || {};
  writeState({ ...state, status, ...extra });
  refreshButton();
}

async function pushOnce(state) {
  const data = snapshot();
  const res = await relay('put', { p_code: state.code, p_payload: { v: 1, data }, p_revision: state.revision ?? null });
  return res;
}

async function syncCore({ restore = false } = {}) {
  let state = readState();
  if (!state?.code) return { skipped: true };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const remote = await relay('get', { p_code: state.code });
      const remoteData = remote?.payload?.data || {};
      const before = snapshot();
      const merged = remote ? mergeSnapshots(before, remoteData, state.base || {}) : before;
      const mergedChanged = changed(before, merged);
      if (mergedChanged) applyData(merged);
      const res = await pushOnce({ code: state.code, revision: remote ? remote.revision : null });
      const after = snapshot();
      state = readState() || state;
      writeState({ ...state, revision: res.revision, lastAt: Date.now(), status: 'ok', error: '', base: after });
      refreshButton();
      return { changed: mergedChanged || changed(before, after), restore };
    } catch (err) {
      if (err.conflict && attempt < 2) continue;
      lastError = err.message || '同步失败';
      setStatus('error', { error: lastError });
      return { error: lastError };
    }
  }
  return { error: '同步冲突' };
}

export async function syncNow({ reloadIfChanged = false } = {}) {
  if (!syncEnabled() || busy) {
    pending = pending || busy;
    return;
  }
  busy = true;
  setStatus('syncing');
  let result;
  try {
    result = await syncCore();
  } finally {
    busy = false;
  }
  if (pending) {
    pending = false;
    scheduleSync();
  }
  if (reloadIfChanged && result?.changed) location.reload();
  return result;
}

export function scheduleSync() {
  if (!syncEnabled()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), DEBOUNCE_MS);
}

async function restoreWithCode(code) {
  const clean = code.trim();
  if (!/^[a-z0-9]{16,128}$/i.test(clean)) throw new Error('同步码格式不对（应为 25 位字母数字）');
  writeState({ code: clean, revision: null, lastAt: 0, status: 'syncing' });
  const remote = await relay('get', { p_code: clean });
  if (!remote) {
    writeState(null);
    throw new Error('云端没有这个同步码的数据，请检查是否输错');
  }
  const before = snapshot();
  const remoteData = remote.payload?.data || {};
  const merged = mergeSnapshots(before, remoteData, remoteData);
  applyData(merged);
  writeState({ code: clean, revision: remote.revision, lastAt: Date.now(), status: 'ok', base: remoteData });
  return { changed: changed(before, merged) };
}

export function stopSync() {
  clearTimeout(timer);
  writeState(null);
  lastError = '';
  refreshButton();
}

function fmtTime(ts) {
  if (!ts) return '从未';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function statusText(state) {
  if (!state?.code) return '未开启';
  if (state.status === 'syncing') return '同步中…';
  if (state.status === 'error') return `同步失败：${escapeHtml(state.error || '')}`;
  return `已同步 ${fmtTime(state.lastAt)}`;
}

export function refreshButton() {
  const btn = document.getElementById('btn-sync');
  if (!btn) return;
  const state = readState();
  btn.innerHTML = `☁️ 云同步 <small>${escapeHtml(statusText(state))}</small>`;
  btn.classList.toggle('on', !!state?.code);
}

export function openSync() {
  const state = readState();
  const on = !!state?.code;
  const html = on
    ? `<h2>☁️ 云同步</h2>
       <p class="dialog-sub">本机已开启同步。换设备时，在新设备输入同一个同步码即可恢复名单、历史与进度。</p>
       <div class="sync-code"><code id="sync-code">${escapeHtml(state.code)}</code></div>
       <p class="dialog-sub">状态：${escapeHtml(statusText(state))}</p>
       <p class="import-hint">同步码就是数据钥匙，请勿发给无关人员。</p>`
    : `<h2>☁️ 云同步</h2>
       <p class="dialog-sub">开启后，本机的学员名单、历史、闯关进度、错词复习与自定义词表会自动同步到云端，可在手机和电脑之间共用。</p>
       <div class="import-box">
         <label class="import-label">已有同步码？在这里输入以恢复数据</label>
         <input id="sync-input" class="import-name" placeholder="输入 25 位同步码" autocomplete="off" />
       </div>
       <p class="import-msg" id="sync-msg"></p>`;
  const actions = on
    ? [
        { label: '立即同步', cls: 'big-btn', onClick: () => { closeDialog(); syncNow({ reloadIfChanged: true }).then(() => toast('同步完成')); } },
        { label: '复制同步码', cls: 'big-btn', onClick: () => copyCode(state.code) },
        { label: '退出同步', cls: 'big-btn red', onClick: () => confirmStop() },
        { label: '关闭', cls: 'big-btn', onClick: () => closeDialog() },
      ]
    : [
        { label: '关闭', cls: 'big-btn', onClick: () => closeDialog() },
        { label: '输入码恢复', cls: 'big-btn', onClick: () => restoreFromInput() },
        { label: '生成同步码', cls: 'big-btn gold', onClick: () => generateFromDialog() },
      ];
  showDialog({ html, actions, dismissible: true });
  document.getElementById('dialog')?.classList.add('students-dialog');
}

function setMsg(text, bad = false) {
  const el = document.getElementById('sync-msg');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('bad', bad);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    toast('同步码已复制');
  } catch {
    toast(`请手动复制：${code}`, 3500);
  }
}

async function generateFromDialog() {
  writeState({ code: randomCode(), revision: null, lastAt: 0, status: 'syncing' });
  refreshButton();
  setMsg('已生成同步码，正在上传到云端…');
  const result = await syncCore();
  closeDialog();
  if (result.error) toast('同步码已生成，但云端暂时连不上，将自动重试', 3500);
  else toast('同步码已生成，请妥善保存');
  openSync();
}

async function restoreFromInput() {
  const input = document.getElementById('sync-input');
  const code = input ? input.value : '';
  setMsg('正在恢复…');
  try {
    const result = await restoreWithCode(code);
    closeDialog();
    if (result.changed) {
      toast('已恢复数据，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } else {
      toast('同步码已开启');
      refreshButton();
    }
  } catch (err) {
    setMsg(err.message || '恢复失败', true);
  }
}

function confirmStop() {
  if (!confirm('退出同步只会删除本机的同步码，本机数据和云端数据都保留。确定退出？')) return;
  stopSync();
  closeDialog();
  toast('已退出云同步（本机数据保留）');
}

export function initSync() {
  refreshButton();
  if (!syncEnabled()) return;
  window.addEventListener('online', () => syncNow());
  syncNow({ reloadIfChanged: true });
}

Storage.prototype.setItem = function setItem(key, value) {
  rawSet.call(this, key, value);
  if (this === localStorage && SYNC_KEYS.includes(key)) scheduleSync();
};
