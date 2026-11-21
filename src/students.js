const KEY = 'word-garden-students-v1';
const HISTORY_MAX = 300;

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cleanStudent(s) {
  if (!s || typeof s !== 'object' || !s.id || typeof s.name !== 'string') return null;
  return {
    id: s.id,
    name: s.name,
    no: typeof s.no === 'string' ? s.no : '',
    createdAt: Number(s.createdAt) || Date.now(),
    progress: s.progress && typeof s.progress === 'object' ? s.progress : {},
    history: Array.isArray(s.history) ? s.history.slice(-HISTORY_MAX) : [],
  };
}

export function loadStudents() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const list = Array.isArray(raw.list) ? raw.list.map(cleanStudent).filter(Boolean) : [];
    const active = list.some((s) => s.id === raw.active) ? raw.active : null;
    return { list, active };
  } catch {
    return { list: [], active: null };
  }
}

export function saveStudents(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function activeStudent() {
  const state = loadStudents();
  return state.list.find((s) => s.id === state.active) || null;
}

export function setActiveStudent(id) {
  const state = loadStudents();
  state.active = state.list.some((s) => s.id === id) ? id : null;
  saveStudents(state);
  return state.active;
}

export function parseStudents(text) {
  const names = [];
  const errors = [];
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw) return;
    const parts = raw.split(/[,，\t;；]/).map((p) => p.trim());
    const name = parts[0];
    const no = parts[1] || '';
    if (!name || /^(name|姓名|学员)$/i.test(name)) return;
    if (name.length > 20 || no.length > 20) {
      errors.push(`第 ${i + 1} 行过长`);
      return;
    }
    names.push({ name, no });
  });
  return { names, errors };
}

export function importStudents(text) {
  const { names, errors } = parseStudents(text);
  const state = loadStudents();
  let added = 0;
  let skipped = 0;
  for (const { name, no } of names) {
    const dup = state.list.some((s) => (no ? s.no === no : s.name === name && !s.no));
    if (dup) {
      skipped += 1;
      continue;
    }
    state.list.push({ id: uid('stu'), name, no, createdAt: Date.now(), progress: {}, history: [] });
    added += 1;
  }
  if (added) {
    state.list = state.list.slice(0, 500);
    saveStudents(state);
  }
  return { added, skipped, errors };
}

export function deleteStudent(id) {
  const state = loadStudents();
  state.list = state.list.filter((s) => s.id !== id);
  if (state.active === id) state.active = null;
  saveStudents(state);
}

export function updateActiveProgress(mutator) {
  const state = loadStudents();
  const student = state.list.find((s) => s.id === state.active);
  if (!student) return false;
  mutator(student.progress);
  saveStudents(state);
  return true;
}

export function addHistory(entry) {
  const state = loadStudents();
  const student = state.list.find((s) => s.id === state.active);
  if (!student) return false;
  student.history.push({ id: uid('h'), ...entry });
  student.history = student.history.slice(-HISTORY_MAX);
  saveStudents(state);
  return true;
}

export function clearHistory(id) {
  const state = loadStudents();
  const student = state.list.find((s) => s.id === id);
  if (student) student.history = [];
  saveStudents(state);
}
