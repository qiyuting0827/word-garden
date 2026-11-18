// 浏览器语音合成：朗读英文单词
let voices = [];

function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
}

if ('speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickVoice() {
  if (!voices.length) refreshVoices();
  const prefer = ['Google US English', 'Microsoft Aria', 'Microsoft Zira', 'Samantha', 'Alex'];
  for (const name of prefer) {
    const hit = voices.find(v => v.name.includes(name));
    if (hit) return hit;
  }
  return voices.find(v => v.lang.toLowerCase() === 'en-us') || voices[0] || null;
}

export function speak(text, { rate = 0.88, pitch = 1 } = {}) {
  if (!('speechSynthesis' in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    utter.pitch = pitch;
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch {
    /* 忽略 */
  }
}

export function spellLetters(word) {
  if (!('speechSynthesis' in window)) return;
  speak(word.split('').join(', '), { rate: 0.7 });
}
