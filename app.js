const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechSupported = Boolean(SpeechRecognition);

const topics = [
  {
    id: "animals",
    title: "动物",
    description: "听听身边的小动物怎么说。",
    color: "#7bdcb5",
    items: [
      { text: "cat", meaning: "小猫", tip: "可以学一声轻轻的 meow，再说 cat。", art: "cat" },
      { text: "dog", meaning: "小狗", tip: "孩子愿意开口就是很棒的一步。", art: "dog" },
      { text: "bird", meaning: "小鸟", tip: "把 bird 说得短短的、轻轻的。", art: "bird" },
      { text: "fish", meaning: "小鱼", tip: "可以用手做游泳动作，边做边说 fish。", art: "fish" },
      { text: "duck", meaning: "鸭子", tip: "先听 d 的开头，再一起说 duck。", art: "duck" },
      { text: "frog", meaning: "青蛙", tip: "夸孩子声音响亮，再慢慢来一次 frog。", art: "frog" }
    ]
  },
  {
    id: "food",
    title: "食物",
    description: "把爱吃的东西用英语说出来。",
    color: "#ffd86b",
    items: [
      { text: "apple", meaning: "苹果", tip: "可以拿真实水果一起说 apple。", art: "apple" },
      { text: "banana", meaning: "香蕉", tip: "banana 有三个小节奏，拍手说一遍。", art: "banana" },
      { text: "milk", meaning: "牛奶", tip: "短短说 milk，不用追求一次完美。", art: "milk" },
      { text: "egg", meaning: "鸡蛋", tip: "egg 很短，鼓励孩子大胆发出来。", art: "egg" },
      { text: "cake", meaning: "蛋糕", tip: "让孩子假装闻一闻蛋糕，再说 cake。", art: "cake" },
      { text: "water", meaning: "水", tip: "water 可以听两遍，再跟着说。", art: "water" }
    ]
  },
  {
    id: "actions",
    title: "动作",
    description: "一边动一边说，身体也记住。",
    color: "#6bb8ff",
    items: [
      { text: "jump", meaning: "跳一跳", tip: "真的跳一下，再快乐地说 jump。", art: "jump" },
      { text: "run", meaning: "跑一跑", tip: "用手做跑步动作，跟着节奏说 run。", art: "run" },
      { text: "clap", meaning: "拍拍手", tip: "拍一下手，说 clap，马上给拥抱式鼓励。", art: "clap" },
      { text: "sit down", meaning: "坐下", tip: "家长先做动作，孩子更容易理解。", art: "sit" },
      { text: "stand up", meaning: "站起来", tip: "站起来时一起说 stand up。", art: "stand" },
      { text: "wave", meaning: "挥挥手", tip: "挥手说 wave，让声音和动作连起来。", art: "wave" }
    ]
  }
];

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
const illustrationFrame = document.querySelector("#illustration-frame");
const wordText = document.querySelector("#word-text");
const wordMeaning = document.querySelector("#word-meaning");
const feedbackTitle = document.querySelector("#feedback-title");
const feedbackDetail = document.querySelector("#feedback-detail");
const listenButton = document.querySelector("#listen-button");
const speakButton = document.querySelector("#speak-button");
const nextButton = document.querySelector("#next-button");

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

function makeSvg(kind, color = "#7bdcb5") {
  const common = `<circle cx="100" cy="100" r="88" fill="${color}" opacity=".24"/><circle cx="100" cy="112" r="62" fill="#fff"/>`;
  const art = {
    cat: `${common}<circle cx="100" cy="95" r="48" fill="#ffcf70"/><path d="M62 62 80 28l16 36M138 62 120 28l-16 36" fill="#ffcf70"/><circle cx="82" cy="92" r="7" fill="#262837"/><circle cx="118" cy="92" r="7" fill="#262837"/><path d="M91 113c7 7 11 7 18 0" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/>`,
    dog: `${common}<ellipse cx="100" cy="98" rx="50" ry="44" fill="#c98b5b"/><ellipse cx="58" cy="86" rx="18" ry="36" fill="#8e5a3d"/><ellipse cx="142" cy="86" rx="18" ry="36" fill="#8e5a3d"/><circle cx="84" cy="92" r="7" fill="#262837"/><circle cx="116" cy="92" r="7" fill="#262837"/><ellipse cx="100" cy="112" rx="12" ry="8" fill="#262837"/>`,
    bird: `${common}<ellipse cx="98" cy="105" rx="50" ry="42" fill="#73c7ff"/><circle cx="124" cy="78" r="26" fill="#73c7ff"/><path d="M147 78h28l-26 16z" fill="#ffb347"/><circle cx="130" cy="72" r="5" fill="#262837"/><path d="M72 108c-24 4-33-8-35-22 20 0 34 6 44 18" fill="#4daeea"/>`,
    fish: `${common}<ellipse cx="94" cy="104" rx="52" ry="34" fill="#ff8f78"/><path d="M140 104l38-30v60z" fill="#ff8f78"/><circle cx="78" cy="96" r="6" fill="#262837"/><path d="M98 72c12-22 30-26 42-10-12 9-25 13-42 10z" fill="#ffd86b"/>`,
    duck: `${common}<ellipse cx="100" cy="112" rx="52" ry="36" fill="#ffd86b"/><circle cx="78" cy="78" r="28" fill="#ffd86b"/><path d="M48 80H16l30 18z" fill="#ff8f78"/><circle cx="86" cy="72" r="5" fill="#262837"/>`,
    frog: `${common}<ellipse cx="100" cy="104" rx="54" ry="44" fill="#72cf7a"/><circle cx="73" cy="67" r="18" fill="#72cf7a"/><circle cx="127" cy="67" r="18" fill="#72cf7a"/><circle cx="73" cy="67" r="6" fill="#262837"/><circle cx="127" cy="67" r="6" fill="#262837"/><path d="M78 112c16 12 28 12 44 0" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/>`,
    apple: `${common}<circle cx="92" cy="112" r="42" fill="#ff6b6b"/><circle cx="118" cy="112" r="42" fill="#ff6b6b"/><path d="M103 70c-2-20 12-34 27-36" fill="none" stroke="#6f8f38" stroke-width="9" stroke-linecap="round"/><path d="M113 58c20-12 34-4 39 10-18 7-31 4-39-10z" fill="#7bdc83"/>`,
    banana: `${common}<path d="M52 119c54 45 116 17 131-45-18 58-81 58-123 23-11-9-19 12-8 22z" fill="#ffd86b"/><path d="M54 112c54 38 104 20 126-36" fill="none" stroke="#d6a738" stroke-width="6" stroke-linecap="round"/>`,
    milk: `${common}<path d="M68 56h64l12 28v70H56V84z" fill="#ffffff" stroke="#262837" stroke-width="6" stroke-linejoin="round"/><path d="M68 56l18-20h46" fill="none" stroke="#262837" stroke-width="6" stroke-linecap="round"/><rect x="70" y="98" width="60" height="36" rx="8" fill="#6bb8ff"/>`,
    egg: `${common}<ellipse cx="100" cy="110" rx="46" ry="62" fill="#fff6df" stroke="#f2c66d" stroke-width="6"/><circle cx="100" cy="122" r="20" fill="#ffd86b"/>`,
    cake: `${common}<rect x="56" y="90" width="88" height="58" rx="12" fill="#ff9aa8"/><path d="M56 104c18 14 29-12 44 0s28-12 44 0V90H56z" fill="#fff"/><rect x="94" y="54" width="12" height="34" fill="#6bb8ff"/><path d="M100 46c12 10 0 20 0 20s-12-10 0-20z" fill="#ffd86b"/>`,
    water: `${common}<path d="M100 42c34 42 50 66 50 91 0 28-22 47-50 47s-50-19-50-47c0-25 16-49 50-91z" fill="#6bb8ff"/><path d="M73 130c6 18 21 26 40 22" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>`,
    jump: `${common}<circle cx="100" cy="60" r="20" fill="#ffcf70"/><path d="M100 82v46M66 100l34-18 34 18M100 128l-30 36M100 128l34 32" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M56 54c10-16 26-26 44-27 18 1 34 11 44 27" fill="none" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`,
    run: `${common}<circle cx="108" cy="58" r="18" fill="#ffcf70"/><path d="M102 80 82 112l34 14M84 112l-34 6M116 126l24 34M112 88l34 8" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M42 142h38" stroke="#ff8f78" stroke-width="8" stroke-linecap="round"/>`,
    clap: `${common}<path d="M72 60c22 30 30 62 22 98-30-10-42-36-42-68 0-18 6-28 20-30z" fill="#ffd86b"/><path d="M128 60c-22 30-30 62-22 98 30-10 42-36 42-68 0-18-6-28-20-30z" fill="#ffcf70"/><path d="M52 48 36 32M148 48l16-16M100 44V20" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`,
    sit: `${common}<circle cx="92" cy="58" r="18" fill="#ffcf70"/><path d="M90 80v44h44M90 124l-26 34M134 124v34" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M128 154h40" stroke="#6bb8ff" stroke-width="9" stroke-linecap="round"/>`,
    stand: `${common}<circle cx="100" cy="54" r="18" fill="#ffcf70"/><path d="M100 76v60M68 96l32-20 32 20M100 136l-22 36M100 136l22 36" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M62 172h76" stroke="#7bdcb5" stroke-width="9" stroke-linecap="round"/>`,
    wave: `${common}<circle cx="88" cy="62" r="18" fill="#ffcf70"/><path d="M88 84v52M88 102l-28 26M88 102l28 24M88 136l-22 34M88 136l26 34" fill="none" stroke="#262837" stroke-width="9" stroke-linecap="round"/><path d="M128 58c18 8 28 22 30 42M142 40c25 14 38 34 40 62" fill="none" stroke="#ff8f78" stroke-width="7" stroke-linecap="round"/>`
  };

  return `<svg viewBox="0 0 200 200" aria-hidden="true">${art[kind] || art.cat}</svg>`;
}

function renderTopics() {
  topicGrid.innerHTML = topics
    .map(
      (topic) => `
        <button class="topic-card" type="button" data-topic="${topic.id}">
          <div class="topic-art">${makeSvg(topic.items[0].art, topic.color)}</div>
          <div>
            <h2>${topic.title}</h2>
            <p>${topic.description}</p>
          </div>
        </button>
      `
    )
    .join("");
}

function speak(text) {
  if (!window.speechSynthesis) {
    setFeedback("可以家长先读一遍", `请家长读：“${text}”，然后让孩子模仿。`);
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.78;
  utterance.pitch = 1.08;
  window.speechSynthesis.speak(utterance);
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

  progressFill.style.width = `${progress}%`;
  progressText.textContent = `${state.index + 1} / ${total}`;
  illustrationFrame.innerHTML = makeSvg(item.art, state.topic.color);
  wordText.textContent = item.text;
  wordMeaning.textContent = item.meaning;
  nextButton.disabled = true;
  speakButton.disabled = false;
  setFeedback("先听英文，再一起说。", "家长可以先示范一次，然后让孩子模仿。");
}

function startTopic(topicId) {
  state.topic = topics.find((topic) => topic.id === topicId);
  state.index = 0;
  state.attempts = 0;
  state.practiced = [];
  showScreen("game");
  renderItem();
  window.setTimeout(() => speak(currentItem().text), 250);
}

function markAttempt(success, transcript = "") {
  const item = currentItem();
  state.attempts += 1;
  if (!state.practiced.includes(item.text)) {
    state.practiced.push(item.text);
  }
  nextButton.disabled = false;

  if (success) {
    setFeedback("说得真勇敢！", transcript ? `我听到：“${transcript}”。家长可以抱抱孩子，再一起说一次 ${item.text}。` : item.tip);
  } else {
    setFeedback("已经开口啦！", "这一题先算完成。家长读慢一点，孩子愿意跟就是进步。");
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
  setFeedback("我在听哦", `请孩子说：“${item.text}”。`);

  recognition.onresult = (event) => {
    recognition.didHearResult = true;
    const transcript = event.results[0][0].transcript;
    const matched = roughlyMatches(transcript, item.text);
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
    window.setTimeout(() => speak(currentItem().text), 200);
    return;
  }

  renderSummary();
}

function renderSummary() {
  document.querySelector("#summary-line").textContent = `完成了「${state.topic.title}」主题：${state.practiced.join("、")}`;
  document.querySelector("#summary-count").textContent = state.practiced.length;
  document.querySelector("#summary-attempts").textContent = state.attempts;
  document.querySelector("#parent-tip").textContent = currentItem().tip || "夸孩子愿意开口，比纠正发音更重要。";
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

  listenButton.addEventListener("click", () => speak(currentItem().text));
  speakButton.addEventListener("click", startRecognition);
  nextButton.addEventListener("click", nextItem);
  document.querySelector("#repeat-button").addEventListener("click", () => startTopic(state.topic.id));
  document.querySelector("#home-button").addEventListener("click", () => showScreen("topic"));
}

supportStatus.textContent = speechSupported
  ? "支持跟读识别；录音不会保存。"
  : "当前浏览器不支持识别，将使用家长确认。";

renderTopics();
bindEvents();
