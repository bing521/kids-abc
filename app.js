const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = Boolean(SpeechRecognition);

let topics = [];

const state = {
  topic: null,
  index: 0,
  attempts: 0,
  practiced: [],
  listening: false,
  recognition: null
};

const screens = {
  topic: document.querySelector("#topic-screen"),
  game: document.querySelector("#game-screen"),
  summary: document.querySelector("#summary-screen")
};

const topicGrid = document.querySelector("#topic-grid");
const supportStatus = document.querySelector("#support-status");
const progressFill = document.querySelector("#progress-fill");
const progressText = document.querySelector("#progress-text");
const rewardRow = document.querySelector("#reward-row");
const missionLabel = document.querySelector("#mission-label");
const missionTitle = document.querySelector("#mission-title");
const illustrationFrame = document.querySelector("#illustration-frame");
const wordText = document.querySelector("#word-text");
const wordMeaning = document.querySelector("#word-meaning");
const wordPhrase = document.querySelector("#word-phrase");
const feedbackTitle = document.querySelector("#feedback-title");
const feedbackDetail = document.querySelector("#feedback-detail");
const listenButton = document.querySelector("#listen-button");
const speakButton = document.querySelector("#speak-button");
const nextButton = document.querySelector("#next-button");
const soundButton = document.querySelector("#sound-button");
const miniMovie = document.querySelector("#mini-movie");
const movieToggle = document.querySelector("#movie-toggle");
const voiceOptions = document.querySelector("#voice-options");

let audioContext = null;
let preferredVoice = null;
let selectedVoiceType = window.localStorage.getItem("little-echo-voice-type") || "girl";
let audioManifest = { phrases: {}, ui: {} };

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioContext = audioContext || new AudioContext();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playToneSequence(notes, type = "sine", volume = 0.06) {
  const context = getAudioContext();
  if (!context) return;

  const start = context.currentTime;
  notes.forEach(([frequency, offset, duration]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    gain.gain.setValueAtTime(0.001, start + offset);
    gain.gain.exponentialRampToValueAtTime(volume, start + offset + 0.026);
    gain.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + duration + 0.02);
  });
}

function playSparkleSound() {
  playToneSequence([[392, 0, 0.08], [523, 0.09, 0.1]], "sine", 0.035);
}

function playSuccessSound() {
  playToneSequence([[440, 0, 0.1], [554, 0.1, 0.12], [659, 0.22, 0.16]], "sine", 0.045);
}

function playTreasureSound() {
  playToneSequence([[392, 0, 0.12], [494, 0.12, 0.12], [587, 0.24, 0.18], [784, 0.42, 0.2]], "sine", 0.05);
}

function audioKey(text) {
  return normalize(text).replace(/\s+/g, "-");
}

async function loadAudioManifest() {
  try {
    const response = await fetch("./audio-manifest.json", { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    audioManifest = {
      phrases: manifest.phrases || {},
      ui: manifest.ui || {}
    };
  } catch (error) {
    audioManifest = { phrases: {}, ui: {} };
  }
}

function getAudioSource(text) {
  const key = audioKey(text);
  const typedPhrases = audioManifest.phrases?.[selectedVoiceType] || {};
  return typedPhrases[text] || typedPhrases[key] || audioManifest.phrases[text] || audioManifest.phrases[key] || null;
}

function playAudioSource(src) {
  if (!src) return false;
  window.speechSynthesis?.cancel();
  const audio = new Audio(src);
  audio.volume = 0.96;
  audio.play().catch((error) => console.warn("Audio playback failed", error));
  return true;
}

function getUsableEnglishVoices() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.filter((voice) =>
    /^en[-_](US|GB|AU|CA)/i.test(voice.lang) &&
    !/compact|novelty|whisper|zarvox|bells|boing|bubbles|bad news|good news|organ|trinoids|cellos|bahh/i.test(voice.name)
  );
}

function scoreVoice(voice, type = selectedVoiceType) {
  let score = 0;
  const girlVoice = /Samantha|Jenny|Aria|Ava|Nicky|Zira|Joanna|Kendra|Kimberly|Serena|Tessa|Moira|Flo|Shelley|female|girl/i;
  const boyVoice = /Aaron|Albert|Daniel|Fred|Alex|Tom|David|Mark|George|Arthur|Eddy|Reed|Rocko|male|boy/i;

  if (type === "girl" && girlVoice.test(voice.name)) score += 90;
  if (type === "girl" && boyVoice.test(voice.name)) score -= 80;
  if (type === "boy" && boyVoice.test(voice.name)) score += 90;
  if (type === "boy" && girlVoice.test(voice.name)) score -= 80;
  if (/Google US English|English United States|Microsoft/i.test(voice.name)) score += 24;
  if (/natural|premium|enhanced/i.test(voice.name)) score += 18;
  if (/en[-_]US/i.test(voice.lang)) score += 14;
  return score;
}

function getFriendlyVoice(type = selectedVoiceType) {
  if (!window.speechSynthesis) return null;
  const voices = getUsableEnglishVoices() || [];
  const cacheKey = `${type}:${voices.length}`;
  if (preferredVoice?.cacheKey === cacheKey) return preferredVoice.voice;

  const voice = voices
    .map((item) => ({ voice: item, score: scoreVoice(item, type) }))
    .sort((a, b) => b.score - a.score)[0]?.voice || null;
  preferredVoice = { cacheKey, voice };
  return preferredVoice.voice;
}

function makeGirlVoiceUtterance(text, options = {}) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.voice = getFriendlyVoice();
  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1;
  utterance.volume = 0.9;
  return utterance;
}

function renderVoiceOptions() {
  if (!voiceOptions) return;
  voiceOptions.querySelectorAll("[data-voice]").forEach((button) => {
    const selected = button.dataset.voice === selectedVoiceType;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function previewVoice(voiceId) {
  if (!window.speechSynthesis) return;
  selectedVoiceType = voiceId === "boy" ? "boy" : "girl";
  window.localStorage.setItem("little-echo-voice-type", selectedVoiceType);
  preferredVoice = null;
  renderVoiceOptions();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(makeGirlVoiceUtterance("Hello, let's learn English."));
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function makeSvg(kind, color = "#7bdcb5") {
  const common = `<circle cx="100" cy="100" r="88" fill="${color}" opacity=".24"/><circle cx="100" cy="112" r="62" fill="#fff"/>`;
  const colorCard = (fill, label, ink = "#ffffff") =>
    `${common}<rect x="48" y="48" width="104" height="120" rx="22" fill="${fill}" stroke="#262837" stroke-width="6"/><circle cx="100" cy="92" r="28" fill="rgba(255,255,255,.25)"/><path d="M68 142h64" stroke="${ink}" stroke-width="9" stroke-linecap="round"/><text x="100" y="103" text-anchor="middle" fill="${ink}" font-size="22" font-weight="900">${label}</text>`;
  const phraseCard = (fill, label, icon = "★") =>
    `${common}<rect x="42" y="46" width="116" height="118" rx="24" fill="${fill}" stroke="#262837" stroke-width="6"/><circle cx="100" cy="82" r="28" fill="#fff" opacity=".9"/><text x="100" y="94" text-anchor="middle" fill="#27315f" font-size="31" font-weight="900">${icon}</text><path d="M62 122h76" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".86"/><rect x="62" y="132" width="76" height="24" rx="12" fill="#ffffff" opacity=".94"/><text x="100" y="150" text-anchor="middle" fill="#27315f" font-size="15" font-weight="900">${label}</text><circle cx="52" cy="54" r="9" fill="#ffd64d"/><circle cx="148" cy="158" r="9" fill="#5ee0b7"/>`;
  const art = {
    cat: `${common}<circle cx="100" cy="95" r="48" fill="#ffcf70"/><path d="M62 62 80 28l16 36M138 62 120 28l-16 36" fill="#ffcf70"/><circle cx="82" cy="92" r="7" fill="#262837"/><circle cx="118" cy="92" r="7" fill="#262837"/><path d="M91 113c7 7 11 7 18 0" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/>`,
    dog: `${common}<ellipse cx="100" cy="98" rx="50" ry="44" fill="#c98b5b"/><ellipse cx="58" cy="86" rx="18" ry="36" fill="#8e5a3d"/><ellipse cx="142" cy="86" rx="18" ry="36" fill="#8e5a3d"/><circle cx="84" cy="92" r="7" fill="#262837"/><circle cx="116" cy="92" r="7" fill="#262837"/><ellipse cx="100" cy="112" rx="12" ry="8" fill="#262837"/>`,
    bird: `${common}<ellipse cx="98" cy="105" rx="50" ry="42" fill="#73c7ff"/><circle cx="124" cy="78" r="26" fill="#73c7ff"/><path d="M147 78h28l-26 16z" fill="#ffb347"/><circle cx="130" cy="72" r="5" fill="#262837"/><path d="M72 108c-24 4-33-8-35-22 20 0 34 6 44 18" fill="#4daeea"/>`,
    fish: `${common}<ellipse cx="94" cy="104" rx="52" ry="34" fill="#ff8f78"/><path d="M140 104l38-30v60z" fill="#ff8f78"/><circle cx="78" cy="96" r="6" fill="#262837"/><path d="M98 72c12-22 30-26 42-10-12 9-25 13-42 10z" fill="#ffd86b"/>`,
    duck: `${common}<ellipse cx="100" cy="112" rx="52" ry="36" fill="#ffd86b"/><circle cx="78" cy="78" r="28" fill="#ffd86b"/><path d="M48 80H16l30 18z" fill="#ff8f78"/><circle cx="86" cy="72" r="5" fill="#262837"/>`,
    frog: `${common}<ellipse cx="100" cy="104" rx="54" ry="44" fill="#72cf7a"/><circle cx="73" cy="67" r="18" fill="#72cf7a"/><circle cx="127" cy="67" r="18" fill="#72cf7a"/><circle cx="73" cy="67" r="6" fill="#262837"/><circle cx="127" cy="67" r="6" fill="#262837"/><path d="M78 112c16 12 28 12 44 0" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/>`,
    bear: `${common}<circle cx="62" cy="62" r="24" fill="#b87949"/><circle cx="138" cy="62" r="24" fill="#b87949"/><circle cx="100" cy="102" r="56" fill="#c98b5b"/><circle cx="82" cy="94" r="7" fill="#262837"/><circle cx="118" cy="94" r="7" fill="#262837"/><ellipse cx="100" cy="118" rx="24" ry="18" fill="#f4c28b"/><circle cx="100" cy="111" r="7" fill="#262837"/>`,
    rabbit: `${common}<path d="M75 82C58 42 64 20 82 28c18 8 17 42 12 58z" fill="#fff"/><path d="M125 82c17-40 11-62-7-54-18 8-17 42-12 58z" fill="#fff"/><circle cx="100" cy="110" r="50" fill="#fff"/><circle cx="82" cy="104" r="6" fill="#262837"/><circle cx="118" cy="104" r="6" fill="#262837"/><circle cx="100" cy="119" r="6" fill="#ff8f78"/><path d="M86 132c10 8 18 8 28 0" fill="none" stroke="#262837" stroke-width="5" stroke-linecap="round"/>`,
    lion: `${common}<circle cx="100" cy="101" r="64" fill="#d98f32"/><circle cx="100" cy="101" r="44" fill="#ffcf70"/><circle cx="84" cy="96" r="6" fill="#262837"/><circle cx="116" cy="96" r="6" fill="#262837"/><path d="M90 118c8 8 12 8 20 0" fill="none" stroke="#262837" stroke-width="5" stroke-linecap="round"/><path d="M48 92h26M126 92h26M56 124h22M122 124h22" stroke="#8f5a24" stroke-width="6" stroke-linecap="round"/>`,
    monkey: `${common}<circle cx="61" cy="96" r="22" fill="#8b5a3c"/><circle cx="139" cy="96" r="22" fill="#8b5a3c"/><circle cx="100" cy="101" r="52" fill="#a86b43"/><ellipse cx="100" cy="116" rx="32" ry="24" fill="#f4c28b"/><circle cx="83" cy="96" r="6" fill="#262837"/><circle cx="117" cy="96" r="6" fill="#262837"/><path d="M90 124c10 8 20 8 30 0" fill="none" stroke="#262837" stroke-width="5" stroke-linecap="round"/>`,
    apple: `${common}<circle cx="92" cy="112" r="42" fill="#ff6b6b"/><circle cx="118" cy="112" r="42" fill="#ff6b6b"/><path d="M103 70c-2-20 12-34 27-36" fill="none" stroke="#6f8f38" stroke-width="9" stroke-linecap="round"/><path d="M113 58c20-12 34-4 39 10-18 7-31 4-39-10z" fill="#7bdc83"/>`,
    banana: `${common}<path d="M52 119c54 45 116 17 131-45-18 58-81 58-123 23-11-9-19 12-8 22z" fill="#ffd86b"/><path d="M54 112c54 38 104 20 126-36" fill="none" stroke="#d6a738" stroke-width="6" stroke-linecap="round"/>`,
    milk: `${common}<path d="M68 56h64l12 28v70H56V84z" fill="#ffffff" stroke="#262837" stroke-width="6" stroke-linejoin="round"/><path d="M68 56l18-20h46" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/><rect x="70" y="98" width="60" height="36" rx="8" fill="#6bb8ff"/>`,
    egg: `${common}<ellipse cx="100" cy="110" rx="46" ry="62" fill="#fff6df" stroke="#f2c66d" stroke-width="6"/><circle cx="100" cy="122" r="20" fill="#ffd86b"/>`,
    cake: `${common}<rect x="56" y="90" width="88" height="58" rx="12" fill="#ff9aa8"/><path d="M56 104c18 14 29-12 44 0s28-12 44 0V90H56z" fill="#fff"/><rect x="94" y="54" width="12" height="34" fill="#6bb8ff"/><path d="M100 46c12 10 0 20 0 20s-12-10 0-20z" fill="#ffd86b"/>`,
    water: `${common}<path d="M100 42c34 42 50 66 50 91 0 28-22 47-50 47s-50-19-50-47c0-25 16-49 50-91z" fill="#6bb8ff"/><path d="M73 130c6 18 21 26 40 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>`,
    orange: `${common}<circle cx="100" cy="112" r="52" fill="#ff9d2e"/><path d="M98 61c6-18 22-24 38-18" fill="none" stroke="#6f8f38" stroke-width="8" stroke-linecap="round"/><path d="M118 55c17-8 30-2 36 10-16 7-27 4-36-10z" fill="#7bdc83"/><path d="M70 104c14-18 44-28 70-8" fill="none" stroke="#ffd86b" stroke-width="7" stroke-linecap="round"/>`,
    bread: `${common}<path d="M58 94c0-34 20-54 42-54s42 20 42 54v56H58z" fill="#d99a55"/><path d="M72 100c6-24 18-36 28-36s22 12 28 36" fill="none" stroke="#f7c98b" stroke-width="9" stroke-linecap="round"/><rect x="58" y="108" width="84" height="44" rx="12" fill="#f0b66c"/>`,
    rice: `${common}<path d="M54 104h92l-12 54H66z" fill="#6bb8ff"/><ellipse cx="100" cy="104" rx="46" ry="18" fill="#ffffff" stroke="#262837" stroke-width="5"/><circle cx="78" cy="98" r="6" fill="#fff6df"/><circle cx="98" cy="94" r="6" fill="#fff6df"/><circle cx="118" cy="100" r="6" fill="#fff6df"/><path d="M54 112h92" stroke="#262837" stroke-width="5" stroke-linecap="round"/>`,
    cookie: `${common}<circle cx="100" cy="108" r="52" fill="#c98448"/><circle cx="78" cy="92" r="7" fill="#5a3825"/><circle cx="112" cy="84" r="7" fill="#5a3825"/><circle cx="124" cy="122" r="7" fill="#5a3825"/><circle cx="88" cy="132" r="7" fill="#5a3825"/><path d="M140 76c-14 8-20 21-12 37 13-2 22-8 28-18" fill="#fff7df"/>`,
    jump: `${common}<circle cx="100" cy="60" r="20" fill="#ffcf70"/><path d="M100 82v46M66 100l34-18 34 18M100 128l-30 36M100 128l34 32" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M56 54c10-16 26-26 44-27 18 1 34 11 44 27" fill="none" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`,
    run: `${common}<circle cx="108" cy="58" r="18" fill="#ffcf70"/><path d="M102 80 82 112l34 14M84 112l-34 6M116 126l24 34M112 88l34 8" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M42 142h38" stroke="#ff8f78" stroke-width="8" stroke-linecap="round"/>`,
    clap: `${common}<path d="M72 60c22 30 30 62 22 98-30-10-42-36-42-68 0-18 6-28 20-30z" fill="#ffd86b"/><path d="M128 60c-22 30-30 62-22 98 30-10 42-36 42-68 0-18-6-28-20-30z" fill="#ffcf70"/><path d="M52 48 36 32M148 48l16-16M100 44V20" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`,
    sit: `${common}<circle cx="92" cy="58" r="18" fill="#ffcf70"/><path d="M90 80v44h44M90 124l-26 34M134 124v34" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M128 154h40" stroke="#6bb8ff" stroke-width="9" stroke-linecap="round"/>`,
    stand: `${common}<circle cx="100" cy="54" r="18" fill="#ffcf70"/><path d="M100 76v60M68 96l32-20 32 20M100 136l-22 36M100 136l22 36" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M62 172h76" stroke="#7bdcb5" stroke-width="9" stroke-linecap="round"/>`,
    wave: `${common}<circle cx="88" cy="62" r="18" fill="#ffcf70"/><path d="M88 84v52M88 102l-28 26M88 102l28 24M88 136l-22 34M88 136l26 34" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M128 58c18 8 28 22 30 42M142 40c25 14 38 34 40 62" fill="none" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`,
    dance: `${common}<circle cx="100" cy="56" r="18" fill="#ffcf70"/><path d="M100 78v50M70 88l30 18 34-28M100 128l-34 28M100 128l36 30" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M54 58c10-12 22-18 38-18M124 42c18 2 30 10 38 24" fill="none" stroke="#ff6f87" stroke-width="7" stroke-linecap="round"/>`,
    sleep: `${common}<circle cx="94" cy="114" r="36" fill="#ffcf70"/><path d="M58 128c24 26 74 32 104 0" fill="none" stroke="#6bb8ff" stroke-width="22" stroke-linecap="round"/><path d="M72 106c8 6 15 6 23 0M108 106c8 6 15 6 23 0" fill="none" stroke="#262837" stroke-width="5" stroke-linecap="round"/><text x="130" y="64" fill="#6f7cff" font-size="28" font-weight="900">Z</text><text x="154" y="42" fill="#6f7cff" font-size="20" font-weight="900">Z</text>`,
    eat: `${common}<circle cx="100" cy="86" r="24" fill="#ffcf70"/><path d="M100 112v42M72 124l28 18 30-18" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><circle cx="54" cy="126" r="18" fill="#ff8f78"/><path d="M154 98v62M142 98v30M166 98v30M142 128h24" stroke="#6bb8ff" stroke-width="7" stroke-linecap="round"/>`,
    drink: `${common}<circle cx="88" cy="70" r="20" fill="#ffcf70"/><path d="M88 92v48M68 108l20 16 28-22" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M128 78h38l-8 78h-22z" fill="#6bb8ff" stroke="#262837" stroke-width="5" stroke-linejoin="round"/><path d="M132 112h28" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>`,
    "color-red": colorCard("#ff4f62", "RED"),
    "color-blue": colorCard("#4f8cff", "BLUE"),
    "color-yellow": colorCard("#ffd84f", "YEL", "#6b4b00"),
    "color-green": colorCard("#48c774", "GREEN"),
    "color-orange": colorCard("#ff9d2e", "ORG", "#5a3000"),
    "color-purple": colorCard("#9b6bff", "PUR"),
    "color-pink": colorCard("#ff8fd1", "PINK", "#6d224d"),
    "color-black": colorCard("#2f3347", "BLK"),
    "color-white": colorCard("#ffffff", "WHITE", "#27315f"),
    "color-brown": colorCard("#9a6238", "BRN"),
    "color-gray": colorCard("#9aa3b2", "GRAY", "#27315f"),
    "color-gold": colorCard("#d9a928", "GOLD", "#4b3100"),
    "color-silver": colorCard("#cfd7df", "SIL", "#27315f"),
    "color-violet": colorCard("#7f5cff", "VIO"),
    "color-rainbow": `${common}<rect x="48" y="48" width="104" height="120" rx="22" fill="#ffffff" stroke="#262837" stroke-width="6"/><path d="M66 126a34 34 0 0 1 68 0" fill="none" stroke="#ff4f62" stroke-width="10" stroke-linecap="round"/><path d="M76 126a24 24 0 0 1 48 0" fill="none" stroke="#ffd84f" stroke-width="10" stroke-linecap="round"/><path d="M86 126a14 14 0 0 1 28 0" fill="none" stroke="#48c774" stroke-width="10" stroke-linecap="round"/><text x="100" y="86" text-anchor="middle" fill="#27315f" font-size="18" font-weight="900">RAIN</text>`,
    "color-navy": colorCard("#1f3a78", "NAVY"),
    "color-turquoise": colorCard("#2dd4bf", "TUR", "#073b3a"),
    "color-beige": colorCard("#e7d3b1", "BEI", "#5a3d23"),
    "color-lime": colorCard("#a3e635", "LIME", "#314700"),
    "color-maroon": colorCard("#7f1d35", "MAR"),
    "phrase-1": phraseCard("#ff8f4a", "HELLO", "☀"),
    "phrase-2": phraseCard("#7f5cff", "NIGHT", "☾"),
    "phrase-3": phraseCard("#5ee0b7", "THANK", "♥"),
    "phrase-4": phraseCard("#5ba8ff", "FRIEND", "☺"),
    "phrase-5": phraseCard("#ffcf70", "TOY", "★"),
    "phrase-6": phraseCard("#ff6f87", "SMILE", "☺"),
    "phrase-7": phraseCard("#ffd64d", "STAR", "★"),
    "phrase-8": phraseCard("#4f8cff", "SKY", "☁"),
    "phrase-9": phraseCard("#ff4f62", "APPLE", "●"),
    "phrase-10": phraseCard("#2dd4bf", "WATER", "∿"),
    "phrase-11": phraseCard("#8bdc65", "YES", "✓"),
    "phrase-12": phraseCard("#9aa3b2", "NO", "×"),
    "phrase-13": phraseCard("#ff9d2e", "HAPPY", "☺"),
    "phrase-14": phraseCard("#48c774", "READY", "▲"),
    "phrase-15": phraseCard("#9b7cff", "PLAY", "▶"),
    "phrase-16": phraseCard("#5ba8ff", "COME", "→"),
    "phrase-17": phraseCard("#ff8fd1", "LOOK", "◉"),
    "phrase-18": phraseCard("#ffd64d", "DONE", "★"),
    "phrase-19": phraseCard("#ff6f87", "TRY", "↻"),
    "phrase-20": phraseCard("#5ee0b7", "BYE", "✦")
  };

  return `<svg viewBox="0 0 200 200" aria-hidden="true">${art[kind] || art.cat}</svg>`;
}

function validateTopics(data) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("words.json must be a non-empty array");
  }

  data.forEach((topic) => {
    if (!topic.id || !topic.title || !Array.isArray(topic.items) || topic.items.length === 0) {
      throw new Error("Each topic needs id, title and items");
    }

    topic.items.forEach((item) => {
      if (!item.text || !item.meaning) {
        throw new Error(`Word item in ${topic.id} needs text and meaning`);
      }
      item.phrase = item.phrase || item.text;
    });
  });

  return data;
}

async function loadTopics() {
  const response = await fetch("./words.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Cannot load words.json: ${response.status}`);
  }

  return validateTopics(await response.json());
}

function renderTopics() {
  if (!topics.length) {
    topicGrid.innerHTML = '<div class="load-error">词表还没有加载出来，请检查 words.json。</div>';
    return;
  }

  topicGrid.innerHTML = topics
    .map((topic, index) => {
      const best = getTopicProgress(topic.id);
      const total = topic.items.length;
      const complete = best >= total;
      return `
        <button class="topic-card" type="button" data-topic="${topic.id}" style="--world-color: ${topic.color};">
          <span class="world-badge">世界 ${index + 1}</span>
          <div class="topic-art">${makeSvg(topic.items[0].art, topic.color)}</div>
          <div>
            <h2>${topic.title}</h2>
            <p>${topic.description}</p>
            <div class="word-count">${total} 个词组</div>
            <div class="level-dots" aria-hidden="true">
              ${topic.items.map((_, levelIndex) => `<i class="${levelIndex < best ? "done" : ""}"></i>`).join("")}
            </div>
            <div class="world-progress" aria-label="${topic.title}通关进度">
              <span>${complete ? "已通关" : `已过 ${best}/${total} 关`}</span>
              <div class="mini-progress"><i style="width: ${(best / total) * 100}%"></i></div>
            </div>
          </div>
        </button>
      `;
    })
    .join("");
}

function getTopicProgress(topicId) {
  const value = window.localStorage.getItem(`little-echo-progress-${topicId}`);
  return Number.parseInt(value || "0", 10) || 0;
}

function saveTopicProgress(topicId, completedCount) {
  const current = getTopicProgress(topicId);
  window.localStorage.setItem(`little-echo-progress-${topicId}`, String(Math.max(current, completedCount)));
}

function speak(text) {
  if (playAudioSource(getAudioSource(text))) {
    return;
  }

  if (!window.speechSynthesis) {
    setFeedback("可以家长先读一遍", `请家长读：“${text}”，然后让孩子模仿。`);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = makeGirlVoiceUtterance(text);
  window.speechSynthesis.speak(utterance);
}

function playWelcomeSound() {
  const welcomeAudio = audioManifest.ui?.[selectedVoiceType]?.welcome || audioManifest.ui?.welcome;
  if (playAudioSource(welcomeAudio)) {
    soundButton.hidden = true;
    return;
  }

  if (!window.speechSynthesis) {
    soundButton.hidden = true;
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = makeGirlVoiceUtterance("Welcome to Little Echo! Let's start the adventure!", {
    rate: 1.0,
    pitch: 1
  });
  utterance.onend = () => {
    soundButton.hidden = true;
  };
  window.speechSynthesis.speak(utterance);
}

function playLockedSound() {
  playToneSequence([[196, 0, 0.08], [174, 0.1, 0.1]], "sine", 0.04);
}

function setNextLocked(locked) {
  nextButton.classList.toggle("is-locked", locked);
  nextButton.setAttribute("aria-disabled", String(locked));
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

function roughlyMatches(transcript, target) {
  const spoken = normalize(transcript);
  const expected = normalize(target);
  return spoken.includes(expected) || expected.split(" ").some((part) => part.length > 2 && spoken.includes(part));
}

function setFeedback(title, detail) {
  feedbackTitle.textContent = title;
  feedbackDetail.textContent = detail;
}

function currentItem() {
  return state.topic.items[state.index];
}

function renderItem() {
  const item = currentItem();
  const total = state.topic.items.length;
  const progress = ((state.index + 1) / total) * 100;
  const levelNumber = state.index + 1;

  illustrationFrame.classList.remove("celebrate");
  renderRewards();
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `第 ${levelNumber} / ${total} 关`;
  missionLabel.textContent = `第 ${levelNumber} 关`;
  missionTitle.textContent = `听一听，说出 ${item.phrase}`;
  illustrationFrame.innerHTML = makeSvg(item.art, state.topic.color);
  wordText.textContent = item.text;
  wordMeaning.textContent = item.meaning;
  wordPhrase.textContent = item.phrase;
  setNextLocked(true);
  speakButton.disabled = false;
  nextButton.textContent = "完成本关后继续";
  setFeedback("闯关任务开始！", "先听英文，再按下跟我说。说出口就能点亮这一关。");
}

function renderRewards() {
  const total = state.topic.items.length;
  rewardRow.innerHTML = Array.from({ length: total }, (_, index) => {
    const earned = index < state.practiced.length ? " is-earned" : "";
    const current = index === state.index ? " is-current" : "";
    return `<span class="reward-star${earned}${current}" aria-label="第 ${index + 1} 关">${index + 1}</span>`;
  }).join("");
}

function startTopic(topicId) {
  state.topic = topics.find((topic) => topic.id === topicId);
  if (!state.topic) return;

  state.index = 0;
  state.attempts = 0;
  state.practiced = [];
  showScreen("game");
  renderItem();
  window.setTimeout(() => speak(currentItem().phrase), 250);
}

function markAttempt(success, transcript = "") {
  const item = currentItem();
  state.attempts += 1;
  if (!state.practiced.includes(item.text)) {
    state.practiced.push(item.text);
  }
  saveTopicProgress(state.topic.id, state.practiced.length);
  renderRewards();
  setNextLocked(false);
  nextButton.textContent = state.index < state.topic.items.length - 1 ? "进入下一关" : "打开终点宝箱";

  if (success) {
    playSuccessSound();
    illustrationFrame.classList.remove("celebrate");
    window.requestAnimationFrame(() => illustrationFrame.classList.add("celebrate"));
    setFeedback("本关通过！", transcript ? `我听到：“${transcript}”。星星已点亮，准备进下一关。` : `${item.tip} 口令是 ${item.phrase}。`);
  } else {
    playSuccessSound();
    setFeedback("本关通过！", "已经勇敢开口啦。家长读慢一点，孩子愿意跟就是进步。");
  }
}

function startRecognition() {
  const item = currentItem();

  if (!speechSupported) {
    markAttempt(true, "");
    return;
  }

  if (state.listening) return;

  const recognition = new SpeechRecognition();
  state.recognition = recognition;
  state.listening = true;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.didHearResult = false;

  speakButton.textContent = "正在听...";
  setFeedback("我在听哦", `请孩子说：“${item.phrase}”。`);

  recognition.onresult = (event) => {
    recognition.didHearResult = true;
    const transcript = event.results[0][0].transcript;
    const matched = roughlyMatches(transcript, item.phrase);
    markAttempt(matched, transcript);
  };

  recognition.onerror = () => {
    recognition.didHearResult = true;
    markAttempt(false);
  };

  recognition.onend = () => {
    if (!recognition.didHearResult) {
      markAttempt(false);
    }
    state.listening = false;
    speakButton.innerHTML = '<span aria-hidden="true">●</span>跟我说';
  };

  recognition.start();
}

function nextItem() {
  if (state.index < state.topic.items.length - 1) {
    state.index += 1;
    renderItem();
    window.setTimeout(() => speak(currentItem().phrase), 200);
    return;
  }

  renderSummary();
}

function renderSummary() {
  playTreasureSound();
  saveTopicProgress(state.topic.id, state.topic.items.length);
  document.querySelector("#summary-line").textContent = `完成「${state.topic.title}」世界：${state.practiced.join("、")}`;
  document.querySelector("#summary-count").textContent = state.practiced.length;
  document.querySelector("#summary-attempts").textContent = state.attempts;
  document.querySelector("#parent-tip").textContent = currentItem().tip || "夸孩子愿意开口，比纠正发音更重要。";
  renderTopics();
  showScreen("summary");
}

function bindEvents() {
  topicGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-topic]");
    if (card) startTopic(card.dataset.topic);
  });

  document.querySelector("#back-button").addEventListener("click", () => {
    window.speechSynthesis?.cancel();
    state.recognition?.abort?.();
    showScreen("topic");
  });

  listenButton.addEventListener("click", () => speak(currentItem().phrase));
  speakButton.addEventListener("click", startRecognition);
  nextButton.addEventListener("click", () => {
    if (nextButton.getAttribute("aria-disabled") === "true") {
      playLockedSound();
      setFeedback("还不能进入下一关", "先点“听一听”，再点“跟我说”。说出口以后就能继续啦。");
      return;
    }
    nextItem();
  });
  soundButton.addEventListener("click", playWelcomeSound);
  voiceOptions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-voice]");
    if (option) previewVoice(option.dataset.voice);
  });
  movieToggle.addEventListener("click", () => {
    const paused = miniMovie.classList.toggle("is-paused");
    movieToggle.textContent = paused ? "播放动画" : "暂停动画";
    movieToggle.setAttribute("aria-pressed", String(paused));
  });
  document.querySelector("#repeat-button").addEventListener("click", () => startTopic(state.topic.id));
  document.querySelector("#home-button").addEventListener("click", () => showScreen("topic"));
}

async function initApp() {
  supportStatus.textContent = "正在加载本地词表...";
  bindEvents();
  await loadAudioManifest();
  renderVoiceOptions();
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      preferredVoice = null;
      renderVoiceOptions();
      getFriendlyVoice();
    };
    getFriendlyVoice();
  }

  try {
    topics = await loadTopics();
    renderTopics();
    supportStatus.textContent = speechSupported
      ? "支持跟读识别；录音不会保存。"
      : "当前浏览器不支持识别，将使用家长确认。";
  } catch (error) {
    console.error(error);
    topicGrid.innerHTML = '<div class="load-error">词表加载失败。请用本地服务打开页面，并检查 words.json 格式。</div>';
    supportStatus.textContent = "词表加载失败";
  }
}

initApp();
