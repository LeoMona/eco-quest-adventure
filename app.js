/*
 Eco Quest Adventure — Cartoon Adventure Edition (Front-end only)
 Revised build (2026-01-31)

 ✅ Fixes included:
 - DOM-safe initialization (runs after DOMContentLoaded)
 - Robust event delegation for Avatar buttons (works even if IDs differ)
 - Defensive null checks so one missing element doesn't break the whole script
 - Corrected fallback logic (e.g., activeStudent())
 - Debug logs to confirm app.js is actually loaded and clicks are captured

 Note: This file assumes your HTML contains the screens/containers used below.
*/

console.log("✅ app.js loaded", new Date().toISOString());

/* ==========================
   Helpers
========================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const STORAGE_KEY = "ecoQuestAdventure_cartoon_v2";

function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}
function escapeXml(str) { return escapeHtml(str); }

function toast(msg) {
  const t = $("#toast");
  if (!t) { console.log("[toast]", msg); return; }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function speak(text) {
  if (!state.readAloud) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.08;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/* ==========================
   Data
========================== */
const badges = [
  { name: "Seedling Saver", stars: 5, icon: "🌱" },
  { name: "Super Recycler", stars: 12, icon: "♻️" },
  { name: "Energy Guardian", stars: 20, icon: "💡" },
  { name: "Planet Pal", stars: 30, icon: "🌍" }
];

const quickWins = [
  "Turn off the tap while brushing teeth 💧",
  "Use a reusable bottle 🥤",
  "Switch off lights when leaving a room 💡",
  "Walk or cycle for short trips 🚶‍♀️🚲",
  "Reuse paper for drawing 📝"
];

const storyHooks = [
  "Captain Carbon spilled glitter-trash (seriously?)… Go save the forest! 🌲✨",
  "Plastic is floating to the ocean… Tara the Turtle needs help! 🌊🐢",
  "The city is wasting energy… Time for your power-down super skills! 🏙️💡"
];

const facts = [
  { emoji: "🌞", q: "Why is Earth getting warmer?", a: "Some gases act like a warm blanket around Earth. Too many makes it hotter." },
  { emoji: "♻️", q: "What does recycle mean?", a: "Recycling turns old things into new things so we make less trash." },
  { emoji: "💡", q: "Why save electricity?", a: "Making electricity can create pollution. Using less helps keep air cleaner." },
  { emoji: "🚲", q: "What travel is greener?", a: "Walking, cycling, buses, and trains often make less pollution per person." },
  { emoji: "🌳", q: "Why are trees important?", a: "Trees help clean the air and provide homes for animals." },
  { emoji: "💧", q: "Why save water?", a: "Clean water is precious. Saving it helps people, animals, and nature." }
];

/* ==========================
   State
========================== */
const state = {
  screen: "home",
  readAloud: false,
  projectorMode: false,

  className: "",
  teacherMission: "all", // all | forest | ocean | city

  activeStudentId: "guest",
  students: [],

  currentBiomeId: null,
  sceneIndex: 0,
  questScenes: [],

  sorter: { remaining: 0, selectedItemId: null },
  energy: { timeLeft: 20, timerId: null, devices: [] },
  travel: { answered: false }
};

/* ==========================
   Students & storage
========================== */
function defaultAvatar() {
  return {
    displayName: "Eco Hero",
    skin: "warm2",
    body: "regular",
    pose: "wave",
    outline: "dark",
    eyes: "happy",
    mouth: "smile",
    cheeks: "none",
    hairStyle: "spiky",
    hairColor: "black",
    outfit: "ranger",
    outfitColor: "green",
    hat: "none",
    accessory: "none",
    sidekick: "none"
  };
}

function makeStudent(id, name) {
  return {
    id,
    name,
    stars: 0,
    score: 0,
    biomeProgress: { forest: false, ocean: false, city: false },
    avatar: defaultAvatar(),
    updatedAt: Date.now()
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.students = [makeStudent("guest", "Guest")];
      state.activeStudentId = "guest";
      return;
    }
    const saved = JSON.parse(raw);
    state.readAloud = saved.readAloud ?? false;
    state.projectorMode = saved.projectorMode ?? false;
    state.className = saved.className ?? "";
    state.teacherMission = saved.teacherMission ?? "all";
    state.activeStudentId = saved.activeStudentId ?? "guest";
    state.students = saved.students ?? [makeStudent("guest", "Guest")];
    if (!state.students.find(s => s.id === "guest")) state.students.push(makeStudent("guest", "Guest"));
  } catch {
    state.students = [makeStudent("guest", "Guest")];
    state.activeStudentId = "guest";
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    readAloud: state.readAloud,
    projectorMode: state.projectorMode,
    className: state.className,
    teacherMission: state.teacherMission,
    activeStudentId: state.activeStudentId,
    students: state.students
  }));
}

// ✅ fixed fallback
function activeStudent() {
  return state.students.find(s => s.id === state.activeStudentId) || state.students[0];
}

function computeBadge(stars) {
  const unlocked = badges.filter(b => stars >= b.stars);
  return unlocked.length ? unlocked[unlocked.length - 1].name : "—";
}

/* ==========================
   Navigation / HUD
========================== */
function setScreen(screen) {
  state.screen = screen;
  $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.screen === screen));
  ["home", "map", "quest", "learn", "teacher"].forEach(s => {
    const el = $("#screen-" + s);
    if (el) el.classList.toggle("active", s === screen);
  });

  if (screen === "map") renderMap();
  if (screen === "learn") renderFacts();
  if (screen === "teacher") renderTeacher();
  if (screen === "home") renderHomeAvatar();
}

function updateHUD() {
  const p = activeStudent();
  if ($("#hudPlayer")) $("#hudPlayer").textContent = p?.name ?? "Guest";
  if ($("#hudStars")) $("#hudStars").textContent = `⭐ ${p?.stars ?? 0}`;
  if ($("#hudBadge")) $("#hudBadge").textContent = computeBadge(p?.stars ?? 0);

  const btnRead = $("#btnRead");
  if (btnRead) {
    btnRead.textContent = `🔊 Read Aloud: ${state.readAloud ? "On" : "Off"}`;
    btnRead.setAttribute("aria-pressed", String(state.readAloud));
  }

  const missionText =
    state.teacherMission === "all" ? "Full Adventure" :
      state.teacherMission === "forest" ? "Forest Only" :
        state.teacherMission === "ocean" ? "Ocean Only" : "City Only";
  const pill = $("#missionLockPill");
  if (pill) pill.textContent = `Teacher Mission: ${missionText}`;
}

/* ==========================
   Avatar options
========================== */
const avatarOptions = {
  skin: [
    { id: "cool1", label: "Cool 1", color: "#f8d7c0" },
    { id: "cool2", label: "Cool 2", color: "#f2c3a2" },
    { id: "warm1", label: "Warm 1", color: "#f6c7a8" },
    { id: "warm2", label: "Warm 2", color: "#eab08c" },
    { id: "tan1", label: "Tan 1", color: "#d99b6c" },
    { id: "deep1", label: "Deep 1", color: "#b8754c" },
    { id: "deep2", label: "Deep 2", color: "#8c5636" }
  ],
  body: [
    { id: "small", label: "Small" },
    { id: "regular", label: "Regular" },
    { id: "tall", label: "Tall" },
    { id: "round", label: "Round" }
  ],
  pose: [
    { id: "wave", label: "Wave 👋" },
    { id: "hero", label: "Hero Pose 🦸" },
    { id: "peace", label: "Peace ✌️" },
    { id: "jump", label: "Jump ✨" }
  ],
  outline: [
    { id: "dark", label: "Dark Outline" },
    { id: "light", label: "Light Outline" }
  ],
  eyes: [
    { id: "happy", label: "Happy 😊" },
    { id: "sparkle", label: "Sparkle ✨" },
    { id: "focused", label: "Focused 😎" },
    { id: "sleepy", label: "Sleepy 😴" }
  ],
  mouth: [
    { id: "smile", label: "Smile 🙂" },
    { id: "biggrin", label: "Big Grin 😁" },
    { id: "ooh", label: "Ooh! 😮" },
    { id: "brave", label: "Brave 😤" }
  ],
  cheeks: [
    { id: "none", label: "None" },
    { id: "blush", label: "Blush 💗" },
    { id: "freckles", label: "Freckles ✴️" }
  ],
  hairStyle: [
    { id: "spiky", label: "Spiky" },
    { id: "curly", label: "Curly" },
    { id: "bob", label: "Bob Cut" },
    { id: "pony", label: "Ponytail" }
  ],
  hairColor: [
    { id: "black", label: "Black", color: "#1b1b1b" },
    { id: "brown", label: "Brown", color: "#4a2c1a" },
    { id: "blonde", label: "Blonde", color: "#d9b35e" },
    { id: "blue", label: "Blue", color: "#2f74ff" },
    { id: "pink", label: "Pink", color: "#ff4fa1" },
    { id: "green", label: "Green", color: "#2fd985" }
  ],
  outfit: [
    { id: "ranger", label: "Forest Ranger 🎒" },
    { id: "diver", label: "Ocean Explorer 🫧" },
    { id: "hero", label: "City Eco Hero 🦸" },
    { id: "casual", label: "Casual Tee 👕" }
  ],
  outfitColor: [
    { id: "green", label: "Green", color: "#35e09a" },
    { id: "blue", label: "Blue", color: "#59b7ff" },
    { id: "yellow", label: "Yellow", color: "#ffd44d" },
    { id: "pink", label: "Pink", color: "#ff6aa6" },
    { id: "orange", label: "Orange", color: "#ff9a3c" }
  ],
  hat: [
    { id: "none", label: "None (free)", req: 0 },
    { id: "cap_leaf", label: "Leaf Cap 🍃 (⭐5)", req: 5 },
    { id: "hat_ocean", label: "Ocean Cap 🐬 (⭐12)", req: 12 },
    { id: "hat_city", label: "City Beanie 🧢 (⭐20)", req: 20 },
    { id: "hat_crown", label: "Planet Crown 👑 (⭐30)", req: 30 }
  ],
  accessory: [
    { id: "none", label: "None (free)", req: 0 },
    { id: "acc_magnify", label: "Magnifier 🔍 (⭐5)", req: 5 },
    { id: "acc_badge", label: "Eco Badge 🏅 (⭐12)", req: 12 },
    { id: "acc_cape", label: "Hero Cape 🦸 (⭐20)", req: 20 },
    { id: "acc_glow", label: "Glow Aura ✨ (⭐30)", req: 30 }
  ],
  sidekick: [
    { id: "none", label: "None (free)", req: 0 },
    { id: "side_owl", label: "Ollie 🦉 (⭐5)", req: 5 },
    { id: "side_turtle", label: "Tara 🐢 (⭐12)", req: 12 },
    { id: "side_crab", label: "Coach 🦀 (⭐20)", req: 20 },
    { id: "side_bot", label: "MiniBot 🤖 (⭐30)", req: 30 }
  ]
};

function canUseOption(option, stars) {
  if (!option || option.req == null) return true;
  return stars >= option.req;
}

function populateSelect(id, list) {
  const sel = $(id);
  if (!sel) return;
  sel.innerHTML = "";
  list.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    sel.appendChild(o);
  });
}

function setSelectValue(id, value) {
  const sel = $(id);
  if (!sel) return;
  const exists = [...sel.options].some(o => o.value === value);
  sel.value = exists ? value : (sel.options[0]?.value ?? "");
}

/* ==========================
   Avatar rendering
========================== */
function renderAvatarSVG(config, stars = 0, size = 280) {
  const skin = avatarOptions.skin.find(x => x.id === config.skin)?.color ?? "#eab08c";
  const hair = avatarOptions.hairColor.find(x => x.id === config.hairColor)?.color ?? "#1b1b1b";
  const outfit = avatarOptions.outfitColor.find(x => x.id === config.outfitColor)?.color ?? "#35e09a";
  const outline = config.outline === "light" ? "#ffffff" : "#061228";

  const bodyScale =
    config.body === "small" ? 0.92 :
      config.body === "tall" ? 1.05 :
        config.body === "round" ? 1.00 : 1.0;

  const belly = config.body === "round" ? 58 : 52;

  const pose = config.pose;
  const armL =
    pose === "wave" ? "rotate(-18 92 160)" :
      pose === "peace" ? "rotate(-8 92 160)" :
        pose === "hero" ? "rotate(-28 92 160)" : "rotate(-8 92 160)";

  const armR =
    pose === "wave" ? "rotate(28 188 160)" :
      pose === "peace" ? "rotate(38 188 160)" :
        pose === "hero" ? "rotate(10 188 160)" : "rotate(10 188 160)";

  const jump = pose === "jump" ? "translate(0,-10)" : "";

  const eyes = (() => {
    if (config.eyes === "sparkle") {
      return `
        <g>
          <circle cx="124" cy="116" r="10" fill="#fff"/>
          <circle cx="184" cy="116" r="10" fill="#fff"/>
          <circle cx="127" cy="114" r="3" fill="#59b7ff"/>
          <circle cx="187" cy="114" r="3" fill="#59b7ff"/>
          <path d="M119 108 l4 6 l-7 -1 z" fill="#ffd44d"/>
          <path d="M179 108 l4 6 l-7 -1 z" fill="#ffd44d"/>
        </g>`;
    }
    if (config.eyes === "focused") {
      return `
        <g>
          <ellipse cx="124" cy="118" rx="10" ry="7" fill="#fff"/>
          <ellipse cx="184" cy="118" rx="10" ry="7" fill="#fff"/>
          <circle cx="127" cy="118" r="4" fill="#061228"/>
          <circle cx="187" cy="118" r="4" fill="#061228"/>
          <path d="M112 108 q12 -10 24 0" fill="none" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
          <path d="M172 108 q12 -10 24 0" fill="none" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
        </g>`;
    }
    if (config.eyes === "sleepy") {
      return `
        <g>
          <path d="M112 118 q12 10 24 0" fill="none" stroke="${outline}" stroke-width="6" stroke-linecap="round"/>
          <path d="M172 118 q12 10 24 0" fill="none" stroke="${outline}" stroke-width="6" stroke-linecap="round"/>
        </g>`;
    }
    return `
      <g>
        <circle cx="124" cy="118" r="10" fill="#fff"/>
        <circle cx="184" cy="118" r="10" fill="#fff"/>
        <circle cx="127" cy="118" r="4" fill="#061228"/>
        <circle cx="187" cy="118" r="4" fill="#061228"/>
        <circle cx="121" cy="113" r="2" fill="#fff"/>
        <circle cx="181" cy="113" r="2" fill="#fff"/>
      </g>`;
  })();

  const mouth = (() => {
    if (config.mouth === "biggrin") return `<path d="M136 146 q24 22 48 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
    if (config.mouth === "ooh") return `<circle cx="160" cy="150" r="10" fill="#fff" stroke="${outline}" stroke-width="6"/>`;
    if (config.mouth === "brave") return `<path d="M142 152 q18 -12 36 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
    return `<path d="M140 150 q20 18 40 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
  })();

  const cheeks = (() => {
    if (config.cheeks === "blush") {
      return `<g opacity=".55">
        <ellipse cx="108" cy="138" rx="10" ry="6" fill="#ff6aa6"/>
        <ellipse cx="212" cy="138" rx="10" ry="6" fill="#ff6aa6"/>
      </g>`;
    }
    if (config.cheeks === "freckles") {
      return `<g opacity=".7">
        <circle cx="110" cy="140" r="2" fill="${outline}"/>
        <circle cx="118" cy="144" r="2" fill="${outline}"/>
        <circle cx="106" cy="146" r="2" fill="${outline}"/>
        <circle cx="210" cy="140" r="2" fill="${outline}"/>
        <circle cx="202" cy="144" r="2" fill="${outline}"/>
        <circle cx="214" cy="146" r="2" fill="${outline}"/>
      </g>`;
    }
    return "";
  })();

  const hairPath = (() => {
    if (config.hairStyle === "curly") {
      return `<path d="M92 92 q25 -40 68 -36 q48 -4 72 36
      q-8 20 -18 26 q-14 -12 -20 -2 q-12 -14 -22 -4 q-10 -12 -20 -2 q-14 -12 -26 -2 q-10 -8 -14 -16z"
      fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
    }
    if (config.hairStyle === "bob") {
      return `<path d="M92 94 q18 -54 68 -52 q54 -2 78 52
      q-8 46 -18 58 q-42 10 -80 0 q-20 -14 -48 -58z"
      fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
    }
    if (config.hairStyle === "pony") {
      return `<g>
        <path d="M92 94 q20 -54 68 -52 q56 -2 78 52 q-6 28 -14 36 q-44 10 -88 0 q-22 -14 -44 -36z"
          fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
        <path d="M230 110 q40 10 30 44 q-10 36 -48 26"
          fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>
        <path d="M230 110 q40 10 30 44 q-10 36 -48 26"
          fill="none" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
      </g>`;
    }
    return `<path d="M90 98 l16 -34 l18 26 l20 -38 l18 30 l22 -40 l16 34 l16 -22 l16 42
    q-18 36 -76 34 q-62 2 -66 -32z"
    fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
  })();

  const outfitShape = (() => {
    if (config.outfit === "diver") {
      return `
        <path d="M110 210 q50 -25 100 0 q-10 62 -50 74 q-40 -12 -50 -74z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <circle cx="160" cy="230" r="10" fill="#fff" stroke="${outline}" stroke-width="6"/>
        <path d="M135 250 q25 18 50 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
    }
    if (config.outfit === "hero") {
      return `
        <path d="M110 210 q50 -30 100 0 q-10 66 -50 78 q-40 -12 -50 -78z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <path d="M160 214 l10 18 l20 2 l-14 14 l4 20 l-20 -10 l-20 10 l4 -20 l-14 -14 l20 -2z"
          fill="#ffd44d" stroke="${outline}" stroke-width="5"/>`;
    }
    if (config.outfit === "casual") {
      return `
        <path d="M112 212 q48 -26 96 0 q-10 62 -48 76 q-38 -14 -48 -76z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <path d="M132 232 h56" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>`;
    }
    return `
      <path d="M110 210 q50 -30 100 0 q-10 66 -50 78 q-40 -12 -50 -78z"
        fill="${outfit}" stroke="${outline}" stroke-width="6"/>
      <path d="M130 230 q30 26 60 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      <path d="M148 210 v78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      <path d="M172 210 v78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>`;
  })();

  const hatLayer = (() => {
    const ok = (req) => stars >= req;
    if (config.hat === "cap_leaf" && ok(5)) {
      return `<path d="M104 90 q56 -44 112 0 q-10 18 -18 18 q-38 -14 -76 0 q-10 0 -18 -18z"
        fill="#35e09a" stroke="${outline}" stroke-width="6"/>`;
    }
    if (config.hat === "hat_ocean" && ok(12)) {
      return `<path d="M104 90 q56 -44 112 0 q-10 18 -18 18 q-38 -14 -76 0 q-10 0 -18 -18z"
        fill="#59b7ff" stroke="${outline}" stroke-width="6"/>`;
    }
    if (config.hat === "hat_city" && ok(20)) {
      return `<path d="M106 80 q54 -40 108 0 v22 q-54 18 -108 0z"
        fill="#1f2a48" stroke="${outline}" stroke-width="6"/>`;
    }
    if (config.hat === "hat_crown" && ok(30)) {
      return `<path d="M108 94 l16 -20 l16 18 l20 -26 l20 26 l16 -18 l16 20 v16 q-52 20 -104 0z"
        fill="#ffd44d" stroke="${outline}" stroke-width="6"/>`;
    }
    return "";
  })();

  const sidekickLayer = (() => {
    const ok = (req) => stars >= req;
    const bubble = (emoji) => `
      <g>
        <circle cx="256" cy="78" r="34" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.18)" stroke-width="6"/>
        <text x="256" y="90" text-anchor="middle" font-size="34">${emoji}</text>
      </g>`;
    if (config.sidekick === "side_owl" && ok(5)) return bubble("🦉");
    if (config.sidekick === "side_turtle" && ok(12)) return bubble("🐢");
    if (config.sidekick === "side_crab" && ok(20)) return bubble("🦀");
    if (config.sidekick === "side_bot" && ok(30)) return bubble("🤖");
    return "";
  })();

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 320 320">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="6" flood-color="rgba(0,0,0,.35)"/>
        </filter>
      </defs>
      <g transform="${jump} scale(${bodyScale}) translate(${(1 - bodyScale) * 160}, ${(1 - bodyScale) * 160})" filter="url(#shadow)">
        <circle cx="160" cy="128" r="78" fill="${skin}" stroke="${outline}" stroke-width="8"/>
        ${hairPath}
        ${hatLayer}
        ${eyes}
        ${cheeks}
        ${mouth}
        ${outfitShape}
        <g transform="${armL}">
          <path d="M120 210 q-52 20 -54 66" fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>
          <path d="M120 210 q-52 20 -54 66" fill="none" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>
        </g>
        <g transform="${armR}">
          <path d="M200 210 q56 20 62 66" fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>
          <path d="M200 210 q56 20 62 66" fill="none" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>
        </g>
        <ellipse cx="160" cy="250" rx="${belly}" ry="46" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.06)" stroke-width="6"/>
        ${sidekickLayer}
      </g>
    </svg>`;
}

/* ==========================
   Home avatar preview
========================== */
function renderHomeAvatar() {
  const p = activeStudent();
  const box = $("#homeAvatarPreview");
  const hint = $("#homeAvatarHint");
  const name = $("#homeAvatarName");
  if (box) box.innerHTML = renderAvatarSVG(p.avatar, p.stars, 240);
  if (name) name.textContent = (p.avatar.displayName || "Eco Hero");
  if (hint) hint.textContent = `Stars unlock gear: ⭐5, ⭐12, ⭐20, ⭐30. You have ⭐ ${p.stars}.`;
}

/* ==========================
   Avatar modal
========================== */
function avatarModalEl() {
  return $("#avatarModal") || $(".avatarModal") || $("[data-role='avatarModal']");
}

function openAvatarModal() {
  const modal = avatarModalEl();
  if (!modal) { toast("Avatar modal not found in HTML"); return; }

  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const p = activeStudent();
  const a = p.avatar;

  populateSelect("#skinTone", avatarOptions.skin);
  populateSelect("#bodyShape", avatarOptions.body);
  populateSelect("#pose", avatarOptions.pose);
  populateSelect("#outline", avatarOptions.outline);
  populateSelect("#eyes", avatarOptions.eyes);
  populateSelect("#mouth", avatarOptions.mouth);
  populateSelect("#cheeks", avatarOptions.cheeks);
  populateSelect("#hairStyle", avatarOptions.hairStyle);
  populateSelect("#hairColor", avatarOptions.hairColor);
  populateSelect("#outfit", avatarOptions.outfit);
  populateSelect("#outfitColor", avatarOptions.outfitColor);
  populateSelect("#hat", avatarOptions.hat);
  populateSelect("#accessory", avatarOptions.accessory);
  populateSelect("#sidekick", avatarOptions.sidekick);

  const dn = $("#heroDisplayName");
  if (dn) dn.value = a.displayName ?? "Eco Hero";

  setSelectValue("#skinTone", a.skin);
  setSelectValue("#bodyShape", a.body);
  setSelectValue("#pose", a.pose);
  setSelectValue("#outline", a.outline);
  setSelectValue("#eyes", a.eyes);
  setSelectValue("#mouth", a.mouth);
  setSelectValue("#cheeks", a.cheeks);
  setSelectValue("#hairStyle", a.hairStyle);
  setSelectValue("#hairColor", a.hairColor);
  setSelectValue("#outfit", a.outfit);
  setSelectValue("#outfitColor", a.outfitColor);
  setSelectValue("#hat", a.hat);
  setSelectValue("#accessory", a.accessory);
  setSelectValue("#sidekick", a.sidekick);

  updateAvatarBuilderUI();
  renderAvatarBuilderPreview();
  speak("Hero builder open. Customize your hero!");
}

function closeAvatarModal() {
  const modal = avatarModalEl();
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function updateAvatarBuilderUI() {
  const p = activeStudent();
  const stars = p.stars;

  const max = 30;
  const pct = Math.min(100, Math.round((stars / max) * 100));
  const fill = $("#unlockFill");
  const txt = $("#unlockText");
  if (fill) fill.style.width = pct + "%";
  if (txt) txt.textContent = `${stars} / ${max} ⭐`;

  ["#hat", "#accessory", "#sidekick"].forEach(selId => {
    const sel = $(selId);
    if (!sel) return;

    const list = selId === "#hat" ? avatarOptions.hat : selId === "#accessory" ? avatarOptions.accessory : avatarOptions.sidekick;

    [...sel.options].forEach(o => {
      const opt = list.find(x => x.id === o.value);
      const ok = canUseOption(opt, stars);
      o.disabled = !ok;
      o.textContent = (opt?.label ?? o.textContent) + (ok ? "" : " 🔒");
    });

    const currentOpt = list.find(x => x.id === sel.value);
    if (currentOpt && !canUseOption(currentOpt, stars)) sel.value = "none";
  });

  const hint = $("#unlockHint");
  if (hint) {
    hint.textContent = stars >= 30
      ? "MAX POWER! You unlocked the top gear! 👑✨"
      : "Earn ⭐ to unlock cool gear! (5 / 12 / 20 / 30)";
  }
}

function readAvatarFromUI() {
  const p = activeStudent();
  const stars = p.stars;
  const a = { ...p.avatar };

  a.displayName = ((($("#heroDisplayName")?.value) || "Eco Hero").trim()).slice(0, 18);
  a.skin = $("#skinTone")?.value || a.skin;
  a.body = $("#bodyShape")?.value || a.body;
  a.pose = $("#pose")?.value || a.pose;
  a.outline = $("#outline")?.value || a.outline;
  a.eyes = $("#eyes")?.value || a.eyes;
  a.mouth = $("#mouth")?.value || a.mouth;
  a.cheeks = $("#cheeks")?.value || a.cheeks;
  a.hairStyle = $("#hairStyle")?.value || a.hairStyle;
  a.hairColor = $("#hairColor")?.value || a.hairColor;
  a.outfit = $("#outfit")?.value || a.outfit;
  a.outfitColor = $("#outfitColor")?.value || a.outfitColor;

  const hatValue = $("#hat")?.value || "none";
  const hatOpt = avatarOptions.hat.find(x => x.id === hatValue);
  a.hat = canUseOption(hatOpt, stars) ? hatValue : "none";

  const accValue = $("#accessory")?.value || "none";
  const accOpt = avatarOptions.accessory.find(x => x.id === accValue);
  a.accessory = canUseOption(accOpt, stars) ? accValue : "none";

  const sideValue = $("#sidekick")?.value || "none";
  const sideOpt = avatarOptions.sidekick.find(x => x.id === sideValue);
  a.sidekick = canUseOption(sideOpt, stars) ? sideValue : "none";

  return a;
}

function renderAvatarBuilderPreview() {
  const p = activeStudent();
  const cfg = readAvatarFromUI();
  const preview = $("#avatarPreview");
  if (preview) preview.innerHTML = renderAvatarSVG(cfg, p.stars, 320);
}

function saveAvatar() {
  console.log("✅ saveAvatar() called");
  const p = activeStudent();
  p.avatar = readAvatarFromUI();
  p.updatedAt = Date.now();
  save();
  renderHomeAvatar();
  updateHUD();
  toast("Hero saved ✅");
  speak("Hero saved.");
  closeAvatarModal();
}

function randomHero() {
  const p = activeStudent();
  const stars = p.stars;
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
  const chooseUnlock = (arr) => {
    const ok = arr.filter(o => canUseOption(o, stars));
    const pool = ok.length ? ok : arr.filter(o => o.id === "none");
    return pool[Math.floor(Math.random() * pool.length)].id;
  };

  const cfg = {
    displayName: "Eco Hero",
    skin: rand(avatarOptions.skin),
    body: rand(avatarOptions.body),
    pose: rand(avatarOptions.pose),
    outline: rand(avatarOptions.outline),
    eyes: rand(avatarOptions.eyes),
    mouth: rand(avatarOptions.mouth),
    cheeks: rand(avatarOptions.cheeks),
    hairStyle: rand(avatarOptions.hairStyle),
    hairColor: rand(avatarOptions.hairColor),
    outfit: rand(avatarOptions.outfit),
    outfitColor: rand(avatarOptions.outfitColor),
    hat: chooseUnlock(avatarOptions.hat),
    accessory: chooseUnlock(avatarOptions.accessory),
    sidekick: chooseUnlock(avatarOptions.sidekick)
  };

  if ($("#heroDisplayName")) $("#heroDisplayName").value = cfg.displayName;
  setSelectValue("#skinTone", cfg.skin);
  setSelectValue("#bodyShape", cfg.body);
  setSelectValue("#pose", cfg.pose);
  setSelectValue("#outline", cfg.outline);
  setSelectValue("#eyes", cfg.eyes);
  setSelectValue("#mouth", cfg.mouth);
  setSelectValue("#cheeks", cfg.cheeks);
  setSelectValue("#hairStyle", cfg.hairStyle);
  setSelectValue("#hairColor", cfg.hairColor);
  setSelectValue("#outfit", cfg.outfit);
  setSelectValue("#outfitColor", cfg.outfitColor);
  setSelectValue("#hat", cfg.hat);
  setSelectValue("#accessory", cfg.accessory);
  setSelectValue("#sidekick", cfg.sidekick);

  updateAvatarBuilderUI();
  renderAvatarBuilderPreview();
  toast("Random hero rolled 🎲");
}

/* ==========================
   Biomes + quest flow
========================== */
const BIOMES = [
  { id: "forest", name: "Forest", icon: "🌲", unlocks: null, desc: "Help animals and keep the forest clean!" },
  { id: "ocean", name: "Ocean", icon: "🌊", unlocks: "forest", desc: "Stop plastic and protect sea friends!" },
  { id: "city", name: "City", icon: "🏙️", unlocks: "ocean", desc: "Save energy and clean city air!" }
];

function story(avatar, who, text, why) { return { type: "story", avatar, who, text, why }; }
function game(kind, payload) { return { type: kind, payload }; }

function biomeScenes(biomeId, playerName) {
  if (biomeId === "forest") {
    return [
      story("🤖", "EcoBot", `Pssst, ${playerName}! Captain Carbon dropped glitter-trash in the forest. Glitter?! Really?! 😂`,
        "Keeping forests clean helps animals and nature."),
      story("😂", "Captain Carbon", "Mwahaha! I made a Trash Tornado! …Wait, why is it spinning into my pants?! WHOOPS!",
        "Trash can hurt wildlife. Sorting helps reduce waste."),
      game("sorter", { theme: "forest" }),
      story("🦉", "Ollie the Owl", "Hoot-hoot! You sorted like a superstar! Now… how should we travel to the ranger station?",
        "Cleaner travel means less pollution."),
      game("travel", { theme: "forest" }),
      story("🦌", "Dara the Deer", "Yay! One more mission: the cabin gadgets are buzzing. Turn off what’s not needed!",
        "Saving electricity reduces pollution."),
      game("energy", { theme: "forest" }),
      story("🌟", "Narrator", "FOREST SAVED! A shiny travel line appears… Next stop: the Ocean! 🌊✨",
        "Great choices can unlock new adventures!")
    ];
  }
  if (biomeId === "ocean") {
    return [
      story("🤖", "EcoBot", `Splash alert, ${playerName}! Plastic is drifting into the sea. Tara the Turtle is not amused 🐢`,
        "Less plastic means safer oceans."),
      story("🐢", "Tara the Turtle", "I like seaweed… not plastic. Let’s fix it together!",
        "Sorting keeps plastic out of oceans."),
      game("sorter", { theme: "ocean" }),
      story("🦀", "Crab Coach", "SNAP-SNAP! Time to choose a clean way to deliver a message on the beach!",
        "Green travel reduces pollution."),
      game("travel", { theme: "ocean" }),
      story("😂", "Captain Carbon", "I turned on ALL the sea-lab screens! Because… um… I like glowing rectangles!",
        "Turning off unused devices saves energy."),
      game("energy", { theme: "ocean" }),
      story("🌟", "Narrator", "OCEAN SPARKLES! A new travel line appears… Next stop: the City! 🏙️✨",
        "You’re becoming a climate champion!")
    ];
  }
  return [
    story("🤖", "EcoBot", `City mission, ${playerName}! Captain Carbon left everything ON again… even the neon donut sign 🍩✨`,
      "Saving energy can reduce pollution."),
    story("🏙️", "Mayor Green", "Welcome, Eco Hero! Let’s power down smartly and keep our air clean!",
      "Clean air helps everyone stay healthy."),
    game("energy", { theme: "city" }),
    story("😂", "Captain Carbon", "Cars! Traffic! Honk-honk! I call it… the Pollution Parade (It’s not a good parade.)",
      "Choosing greener travel lowers pollution."),
    game("travel", { theme: "city" }),
    story("♻️", "Recycling Crew", "Final mission: sort city trash correctly so we can recycle more!",
      "Recycling saves resources and reduces waste."),
    game("sorter", { theme: "city" }),
    story("🏆", "Narrator", "ALL BIOMES COMPLETE! You are officially an Eco Hero legend! 🌍💚",
      "Keep using these habits in real life!")
  ];
}

function biomeUnlocked(biomeId) {
  const b = BIOMES.find(x => x.id === biomeId);
  if (!b) return false;
  if (!b.unlocks) return true;
  return Boolean(activeStudent().biomeProgress[b.unlocks]);
}

function biomeComplete(biomeId) { return Boolean(activeStudent().biomeProgress[biomeId]); }

function missionAllows(biomeId) {
  if (state.teacherMission === "all") return true;
  return state.teacherMission === biomeId;
}

/* ==========================
   MAP
========================== */
function renderBiomeNode(id, x, y, unlocked, complete) {
  const biome = BIOMES.find(b => b.id === id);
  const fill = complete ? "#ffd44d" : unlocked ? "#35e09a" : "rgba(255,255,255,.25)";
  const stroke = "rgba(255,255,255,.18)";
  const label = `${biome.icon} ${biome.name}`;
  return `
    <g transform="translate(${x},${y})" filter="url(#soft)">
      <circle r="44" fill="rgba(0,0,0,.18)" stroke="${stroke}" stroke-width="6"></circle>
      <circle r="34" fill="${fill}" opacity=".85"></circle>
      <text y="10" text-anchor="middle" font-size="34">${biome.icon}</text>
      <text x="0" y="74" text-anchor="middle" font-size="14" fill="#ffffff" font-weight="1100">${label}</text>
    </g>`;
}

function addBiomeHotspots(stage, nodes) {
  const overlay = stage.querySelector(".mapButtons");
  if (!overlay) return;
  overlay.innerHTML = "";

  const viewW = 820, viewH = 360;
  const w = stage.clientWidth || 820;
  const h = stage.clientHeight || 360;
  const sx = w / viewW;
  const sy = h / viewH;

  BIOMES.forEach(b => {
    const pos = nodes[b.id];
    const unlocked = biomeUnlocked(b.id);
    const complete = biomeComplete(b.id);
    const allowed = missionAllows(b.id);

    const btn = document.createElement("button");
    btn.className = "mapHotspot";
    btn.style.position = "absolute";
    btn.style.left = (pos.x * sx - 70) + "px";
    btn.style.top = (pos.y * sy - 70) + "px";
    btn.style.width = "140px";
    btn.style.height = "140px";
    btn.style.borderRadius = "30px";
    btn.style.border = "0";
    btn.style.background = "transparent";
    btn.style.cursor = unlocked ? "pointer" : "not-allowed";
    btn.setAttribute("aria-label", `${b.name} biome. ${unlocked ? "Unlocked" : "Locked"}. ${complete ? "Completed" : ""}`);

    btn.addEventListener("click", () => {
      if (!unlocked) {
        toast("Locked! Finish the previous biome first 🔒");
        speak("Locked. Finish the previous biome first.");
        return;
      }
      if (!allowed) {
        toast("Teacher mission restricts this biome today 🎯");
        speak("Teacher mission restricts this biome today.");
        return;
      }
      startBiomeQuest(b.id);
    });

    overlay.appendChild(btn);
  });
}

function renderMap() {
  const stage = $("#mapStage");
  if (!stage) return;

  const p = activeStudent();
  updateHUD();

  const oceanUnlocked = biomeUnlocked("ocean");
  const cityUnlocked = biomeUnlocked("city");
  const forestDone = biomeComplete("forest");
  const oceanDone = biomeComplete("ocean");
  const cityDone = biomeComplete("city");

  const nodes = {
    forest: { x: 140, y: 260 },
    ocean: { x: 380, y: 150 },
    city: { x: 650, y: 220 }
  };

  const line1Visible = oceanUnlocked;
  const line2Visible = cityUnlocked;

  stage.innerHTML = `
    <svg viewBox="0 0 820 360" width="100%" height="360" aria-label="Biome map">
      <defs>
        <linearGradient id="pathGlow" x1="0" x2="1">
          <stop offset="0%" stop-color="#35e09a"/>
          <stop offset="50%" stop-color="#ffd44d"/>
          <stop offset="100%" stop-color="#59b7ff"/>
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="rgba(0,0,0,.35)"/>
        </filter>
      </defs>

      <g opacity=".35">
        <circle cx="120" cy="90" r="80" fill="#59b7ff"/>
        <circle cx="420" cy="60" r="90" fill="#35e09a"/>
        <circle cx="700" cy="100" r="70" fill="#ffd44d"/>
      </g>

      <path id="path1"
        d="M ${nodes.forest.x} ${nodes.forest.y} C 230 220, 260 170, ${nodes.ocean.x} ${nodes.ocean.y}"
        fill="none" stroke="url(#pathGlow)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="18 14" opacity="${line1Visible ? 1 : 0.18}">
        ${line1Visible ? `<animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.4s" repeatCount="indefinite" />` : ``}
      </path>

      <path id="path2"
        d="M ${nodes.ocean.x} ${nodes.ocean.y} C 500 70, 590 120, ${nodes.city.x} ${nodes.city.y}"
        fill="none" stroke="url(#pathGlow)" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="18 14" opacity="${line2Visible ? 1 : 0.18}">
        ${line2Visible ? `<animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.4s" repeatCount="indefinite" />` : ``}
      </path>

      ${line1Visible && forestDone && !oceanDone ? `
        <g filter="url(#soft)">
          <circle r="16" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.22)" stroke-width="6"/>
          <text y="8" text-anchor="middle" font-size="18">🤖</text>
          <animateMotion dur="2.8s" repeatCount="indefinite" rotate="auto">
            <mpath href="#path1"></mpath>
          </animateMotion>
        </g>` : ``}

      ${line2Visible && oceanDone && !cityDone ? `
        <g filter="url(#soft)">
          <circle r="16" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.22)" stroke-width="6"/>
          <text y="8" text-anchor="middle" font-size="18">🤖</text>
          <animateMotion dur="2.8s" repeatCount="indefinite" rotate="auto">
            <mpath href="#path2"></mpath>
          </animateMotion>
        </g>` : ``}

      ${renderBiomeNode("forest", nodes.forest.x, nodes.forest.y, biomeUnlocked("forest"), forestDone)}
      ${renderBiomeNode("ocean", nodes.ocean.x, nodes.ocean.y, oceanUnlocked, oceanDone)}
      ${renderBiomeNode("city", nodes.city.x, nodes.city.y, cityUnlocked, cityDone)}

      <g transform="translate(20,20)" filter="url(#soft)">
        <rect x="0" y="0" width="210" height="86" rx="18" fill="rgba(0,0,0,.20)" stroke="rgba(255,255,255,.18)" stroke-width="4"/>
        <foreignObject x="10" y="10" width="66" height="66">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:66px;height:66px;border-radius:16px;overflow:hidden;border:4px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);display:grid;place-items:center;">
            ${renderAvatarSVG(p.avatar, p.stars, 66)}
          </div>
        </foreignObject>
        <text x="90" y="35" font-size="14" fill="#cfe3ff" font-weight="900">Player</text>
        <text x="90" y="60" font-size="18" fill="#ffffff" font-weight="1100">${escapeXml(p.name)}</text>
      </g>
    </svg>
    <div class="mapButtons" aria-label="Map buttons"></div>
  `;

  addBiomeHotspots(stage, nodes);
}

/* ==========================
   Quest flow & mini-games
========================== */
function startBiomeQuest(biomeId) {
  const p = activeStudent();
  state.currentBiomeId = biomeId;
  state.sceneIndex = 0;
  state.questScenes = biomeScenes(biomeId, p.name);
  setScreen("quest");
  renderScene();
}

function stopEnergyTimer() {
  if (state.energy.timerId) {
    clearInterval(state.energy.timerId);
    state.energy.timerId = null;
  }
}

function renderScene() {
  const root = $("#questStage");
  if (!root) return;

  stopEnergyTimer();

  const scene = state.questScenes[state.sceneIndex];
  if (!scene) return;

  updateHUD();

  if (scene.type === "story") {
    root.innerHTML = `
      <div class="questCard">
        <div class="questTop">
          <div class="questAvatar">${scene.avatar}</div>
          <div class="questWho">
            <div class="whoName">${escapeHtml(scene.who)}</div>
            <div class="whyText">${escapeHtml(scene.why)}</div>
          </div>
        </div>
        <div class="questText">${escapeHtml(scene.text)}</div>

        <div class="questNav">
          <button id="btnPrevScene" class="btnSecondary">⬅️ Back</button>
          <button id="btnNextScene" class="btnPrimary">Next ➡️</button>
          <button id="btnBackToMap" class="btnGhost">🗺️ Map</button>
        </div>
      </div>
    `;
    on($("#btnPrevScene"), "click", prevScene);
    on($("#btnNextScene"), "click", nextScene);
    on($("#btnBackToMap"), "click", () => setScreen("map"));
    speak(scene.text);
    return;
  }

  if (scene.type === "sorter") return renderWasteSorter(scene.payload);
  if (scene.type === "travel") return renderTravelChoice(scene.payload);
  if (scene.type === "energy") return renderEnergyDash(scene.payload);
}

function prevScene() {
  state.sceneIndex = clamp(state.sceneIndex - 1, 0, state.questScenes.length - 1);
  renderScene();
}

function awardStars(n, reason = "") {
  const p = activeStudent();
  p.stars += n;
  p.score += n * 10;
  p.updatedAt = Date.now();
  save();
  updateHUD();
  renderHomeAvatar();
  toast(reason ? `+${n}⭐ ${reason}` : `+${n}⭐ Great job!`);
}

function completeBiome(biomeId) {
  const p = activeStudent();
  if (!p.biomeProgress[biomeId]) {
    p.biomeProgress[biomeId] = true;
    awardStars(3, "Biome complete!");
  } else {
    toast("Biome already completed ✅");
  }
  save();
  setScreen("map");
  renderMap();
}

function nextScene() {
  state.sceneIndex++;
  if (state.sceneIndex >= state.questScenes.length) {
    completeBiome(state.currentBiomeId);
    return;
  }
  renderScene();
}

// ---- Waste sorter ----
function wasteItemsForTheme(theme) {
  const base = [
    { id: "bottle", name: "Plastic Bottle", type: "recycle", emoji: "🧴" },
    { id: "paper", name: "Paper", type: "recycle", emoji: "📄" },
    { id: "banana", name: "Banana Peel", type: "compost", emoji: "🍌" },
    { id: "apple", name: "Apple Core", type: "compost", emoji: "🍎" },
    { id: "wrapper", name: "Candy Wrapper", type: "trash", emoji: "🍬" },
    { id: "broken", name: "Broken Toy", type: "trash", emoji: "🧸" }
  ];
  if (theme === "ocean") {
    base.push({ id: "net", name: "Old Fishing Net", type: "trash", emoji: "🕸️" });
    base.push({ id: "can", name: "Soda Can", type: "recycle", emoji: "🥫" });
  }
  if (theme === "city") {
    base.push({ id: "battery", name: "Battery (special)", type: "trash", emoji: "🔋" });
    base.push({ id: "box", name: "Cardboard Box", type: "recycle", emoji: "📦" });
  }
  return shuffle(base).slice(0, 7);
}

function renderWasteSorter(payload) {
  const root = $("#questStage");
  if (!root) return;

  const items = wasteItemsForTheme(payload.theme);
  state.sorter.remaining = items.length;

  root.innerHTML = `
    <div class="questCard">
      <h2>♻️ Waste Sorter</h2>
      <p>Tap an item, then choose the bin. Sort all to win ⭐!</p>

      <div class="sorterGrid" id="sorterGrid"></div>

      <div class="bins">
        <button class="binBtn" data-bin="recycle">♻️ Recycle</button>
        <button class="binBtn" data-bin="compost">🌱 Compost</button>
        <button class="binBtn" data-bin="trash">🗑️ Trash</button>
      </div>

      <div class="questNav">
        <button id="btnBackToMap" class="btnGhost">🗺️ Map</button>
      </div>

      <div class="miniHint" id="miniHint"></div>
    </div>
  `;

  const grid = $("#sorterGrid");
  const hint = $("#miniHint");

  items.forEach(it => {
    const card = document.createElement("button");
    card.className = "itemCard";
    card.dataset.id = it.id;
    card.dataset.type = it.type;
    card.innerHTML = `<div class="itemEmoji">${it.emoji}</div><div class="itemName">${escapeHtml(it.name)}</div>`;
    card.addEventListener("click", () => {
      $$(".itemCard").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      state.sorter.selectedItemId = it.id;
      if (hint) hint.textContent = `Selected: ${it.name}. Now choose a bin!`;
    });
    grid?.appendChild(card);
  });

  $$(".binBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = $(".itemCard.selected");
      if (!selected) { toast("Pick an item first 🙂"); return; }

      const correctType = selected.dataset.type;
      const chosen = btn.dataset.bin;

      if (chosen === correctType) {
        selected.disabled = true;
        selected.classList.remove("selected");
        selected.classList.add("done");
        state.sorter.remaining -= 1;
        awardStars(1, "Correct sort!");
        if (hint) hint.textContent = `Nice! ${state.sorter.remaining} left.`;
      } else {
        toast("Oops! Try a different bin 😄");
      }

      if (state.sorter.remaining <= 0) {
        toast("Sorter complete! ✅");
        speak("Sorter complete!");
        setTimeout(nextScene, 700);
      }
    });
  });

  on($("#btnBackToMap"), "click", () => setScreen("map"));
}

// ---- Travel choice ----
function renderTravelChoice(payload) {
  const root = $("#questStage");
  if (!root) return;

  state.travel.answered = false;

  const questions = {
    forest: {
      prompt: "How should we travel to the ranger station?",
      options: [
        { label: "Walk 🚶‍♀️", good: true },
        { label: "Cycle 🚲", good: true },
        { label: "Car alone 🚗", good: false }
      ]
    },
    ocean: {
      prompt: "How should we deliver the message along the beach?",
      options: [
        { label: "Walk 🚶‍♀️", good: true },
        { label: "Bike 🚲", good: true },
        { label: "Speedboat (just for fun) 🚤", good: false }
      ]
    },
    city: {
      prompt: "How should we go across town?",
      options: [
        { label: "Bus 🚌", good: true },
        { label: "Train 🚆", good: true },
        { label: "Car in traffic 🚗", good: false }
      ]
    }
  };

  const q = questions[payload.theme] ?? questions.forest;

  root.innerHTML = `
    <div class="questCard">
      <h2>🚲 Clean Travel Choice</h2>
      <p>${escapeHtml(q.prompt)}</p>
      <div class="choiceRow">
        ${q.options.map(o => `<button class="choiceBtn" data-good="${o.good ? "1" : "0"}">${escapeHtml(o.label)}</button>`).join("")}
      </div>
      <div class="miniHint" id="travelHint"></div>
      <div class="questNav">
        <button id="btnBackToMap" class="btnGhost">🗺️ Map</button>
      </div>
    </div>
  `;

  const hint = $("#travelHint");

  $$(".choiceBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.travel.answered) return;
      state.travel.answered = true;
      const good = btn.dataset.good === "1";
      if (good) {
        awardStars(1, "Green travel!");
        if (hint) hint.textContent = "Awesome! Cleaner travel = less pollution ✅";
        speak("Great choice! Cleaner travel helps the planet.");
      } else {
        if (hint) hint.textContent = "Hmm… not the greenest choice. Try again next time!";
        speak("That choice creates more pollution. Try a greener option next time.");
      }
      setTimeout(nextScene, 900);
    });
  });

  on($("#btnBackToMap"), "click", () => setScreen("map"));
}

// ---- Energy dash ----
function devicesForTheme(theme) {
  const base = [
    { id: "light", name: "Lights", on: true, emoji: "💡" },
    { id: "fan", name: "Fan", on: true, emoji: "🌀" },
    { id: "tv", name: "TV", on: true, emoji: "📺" },
    { id: "computer", name: "Computer", on: true, emoji: "💻" }
  ];
  if (theme === "ocean") base.push({ id: "screens", name: "Lab Screens", on: true, emoji: "🖥️" });
  if (theme === "city") base.push({ id: "sign", name: "Neon Sign", on: true, emoji: "🍩" });
  if (theme === "forest") base.push({ id: "heater", name: "Heater", on: true, emoji: "🔥" });
  return shuffle(base).slice(0, 5);
}

function renderEnergyDash(payload) {
  const root = $("#questStage");
  if (!root) return;

  state.energy.timeLeft = 20;
  state.energy.devices = devicesForTheme(payload.theme);

  root.innerHTML = `
    <div class="questCard">
      <h2>💡 Energy Dash</h2>
      <p>Turn OFF everything that’s not needed before time runs out!</p>

      <div class="energyHeader">
        <div class="timer">⏱️ Time: <span id="energyTime">20</span>s</div>
        <div class="miniHint" id="energyHint"></div>
      </div>

      <div class="deviceGrid" id="deviceGrid"></div>

      <div class="questNav">
        <button id="btnBackToMap" class="btnGhost">🗺️ Map</button>
      </div>
    </div>
  `;

  const timeEl = $("#energyTime");
  const hint = $("#energyHint");
  const grid = $("#deviceGrid");

  function redraw() {
    if (!grid) return;
    grid.innerHTML = "";
    state.energy.devices.forEach(d => {
      const btn = document.createElement("button");
      btn.className = "deviceBtn " + (d.on ? "on" : "off");
      btn.innerHTML = `<span class="devEmoji">${d.emoji}</span> ${escapeHtml(d.name)} — <b>${d.on ? "ON" : "OFF"}</b>`;
      btn.addEventListener("click", () => {
        d.on = !d.on;
        redraw();
        const leftOn = state.energy.devices.filter(x => x.on).length;
        if (hint) hint.textContent = leftOn ? `${leftOn} still ON… keep going!` : `All OFF! 🎉`;
        if (leftOn === 0) finish(true);
      });
      grid.appendChild(btn);
    });
  }

  function finish(win) {
    stopEnergyTimer();
    const leftOn = state.energy.devices.filter(x => x.on).length;
    if (win || leftOn === 0) {
      awardStars(2, "Energy saved!");
      toast("Energy Dash complete ✅");
      speak("Energy saved. Great job!");
    } else {
      toast("Time up! Try again next time 😄");
      speak("Time is up. Try again next time.");
    }
    setTimeout(nextScene, 900);
  }

  redraw();

  state.energy.timerId = setInterval(() => {
    state.energy.timeLeft -= 1;
    if (timeEl) timeEl.textContent = String(state.energy.timeLeft);
    if (state.energy.timeLeft <= 0) finish(false);
  }, 1000);

  on($("#btnBackToMap"), "click", () => setScreen("map"));
}

/* ==========================
   Learn / Facts
========================== */
function renderFacts() {
  const stage = $("#factsStage");
  if (!stage) return;
  stage.innerHTML = `
    <div class="factsWrap">
      ${facts.map(f => `
        <div class="factCard">
          <div class="factEmoji">${f.emoji}</div>
          <div class="factQ">${escapeHtml(f.q)}</div>
          <div class="factA">${escapeHtml(f.a)}</div>
        </div>`).join("")}
    </div>
  `;
}

/* ==========================
   Teacher dashboard
========================== */
function renderTeacher() {
  const stage = $("#teacherStage");
  if (!stage) return;

  const missionText =
    state.teacherMission === "all" ? "Full Adventure" :
      state.teacherMission === "forest" ? "Forest Only" :
        state.teacherMission === "ocean" ? "Ocean Only" : "City Only";

  const rows = state.students.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${s.stars}</td>
      <td>${escapeHtml(computeBadge(s.stars))}</td>
      <td>${s.biomeProgress.forest ? "✅" : "—"}</td>
      <td>${s.biomeProgress.ocean ? "✅" : "—"}</td>
      <td>${s.biomeProgress.city ? "✅" : "—"}</td>
      <td><button class="btnMini" data-student="${escapeHtml(s.id)}">Select</button></td>
    </tr>
  `).join("");

  stage.innerHTML = `
    <div class="teacherWrap">
      <div class="teacherTop">
        <div>
          <label>Class Name</label>
          <input id="className" value="${escapeHtml(state.className)}" placeholder="e.g., Grade 4A"/>
        </div>

        <div>
          <label>Mission Lock</label>
          <select id="missionSelect">
            <option value="all" ${state.teacherMission === "all" ? "selected" : ""}>Full Adventure</option>
            <option value="forest" ${state.teacherMission === "forest" ? "selected" : ""}>Forest Only</option>
            <option value="ocean" ${state.teacherMission === "ocean" ? "selected" : ""}>Ocean Only</option>
            <option value="city" ${state.teacherMission === "city" ? "selected" : ""}>City Only</option>
          </select>
          <button id="btnSaveMission" class="btnSecondary">Save Mission</button>
        </div>

        <div>
          <label>Add Student</label>
          <input id="newStudentName" placeholder="Student name"/>
          <button id="btnAddStudent" class="btnSecondary">Add</button>
        </div>

        <div class="teacherButtons">
          <button id="btnExportCSV" class="btnSecondary">Export CSV</button>
          <button id="btnPrintCert" class="btnPrimary">Print Certificate</button>
          <button id="btnResetClass" class="btnGhost">Reset Class</button>
          <button id="btnProjector" class="btnGhost">Projector Mode</button>
        </div>
      </div>

      <div class="teacherMeta">
        <span><b>Active:</b> ${escapeHtml(activeStudent().name)}</span>
        <span><b>Mission:</b> ${missionText}</span>
      </div>

      <table class="teacherTable">
        <thead>
          <tr>
            <th>Name</th><th>Stars</th><th>Badge</th>
            <th>Forest</th><th>Ocean</th><th>City</th><th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  on($("#className"), "input", (e) => { state.className = e.target.value; save(); });
  on($("#btnSaveMission"), "click", () => {
    state.teacherMission = $("#missionSelect")?.value || "all";
    save();
    updateHUD();
    toast("Mission saved 🎯");
  });
  on($("#btnAddStudent"), "click", addStudent);
  on($("#btnExportCSV"), "click", exportCSV);
  on($("#btnResetClass"), "click", resetClass);
  on($("#btnPrintCert"), "click", printCertificate);
  on($("#btnProjector"), "click", () => {
    state.projectorMode = !state.projectorMode;
    document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";
    save();
    toast(`Projector Mode ${state.projectorMode ? "On" : "Off"}`);
  });

  $$(".btnMini", stage).forEach(b => {
    on(b, "click", () => {
      const id = b.dataset.student;
      if (!id) return;
      state.activeStudentId = id;
      save();
      updateHUD();
      renderHomeAvatar();
      toast(`Active student: ${activeStudent().name}`);
      renderTeacher();
    });
  });
}

function addStudent() {
  const input = $("#newStudentName");
  const name = (input?.value || "").trim();
  if (!name) { toast("Type a student name 🙂"); return; }
  const id = "s_" + Math.random().toString(16).slice(2, 10);
  state.students.push(makeStudent(id, name));
  if (input) input.value = "";
  save();
  toast("Student added ✅");
  renderTeacher();
}

function resetClass() {
  const keepGuest = state.students.find(s => s.id === "guest") || makeStudent("guest", "Guest");
  state.students = [keepGuest];
  state.activeStudentId = "guest";
  state.className = "";
  state.teacherMission = "all";
  save();
  toast("Class reset ✅");
  updateHUD();
  renderTeacher();
  renderHomeAvatar();
}

function exportCSV() {
  const lines = [];
  lines.push(["Class", "Name", "Stars", "Badge", "Forest", "Ocean", "City"].join(","));
  state.students.forEach(s => {
    lines.push([
      `"${String(state.className).replace(/"/g, '""')}"`,
      `"${String(s.name).replace(/"/g, '""')}"`,
      s.stars,
      `"${computeBadge(s.stars).replace(/"/g, '""')}"`,
      s.biomeProgress.forest ? "Yes" : "No",
      s.biomeProgress.ocean ? "Yes" : "No",
      s.biomeProgress.city ? "Yes" : "No"
    ].join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ecoquest_class_${(state.className || "class").replace(/\s+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSV downloaded ✅");
}

function printCertificate() {
  const s = activeStudent();
  const cls = state.className || "Eco Quest Class";
  const badge = computeBadge(s.stars);
  const dateStr = new Date().toLocaleDateString();

  const w = window.open("", "_blank");
  if (!w) { toast("Popup blocked. Allow popups to print certificate."); return; }

  w.document.write(`
    <html>
    <head>
      <title>Certificate</title>
      <style>
        body{font-family:system-ui,Segoe UI,Arial; padding:40px; background:#f5fbff;}
        .cert{max-width:900px;margin:auto;background:white;border-radius:18px;padding:40px;border:4px solid #35e09a;}
        h1{margin:0 0 10px;font-size:42px;}
        .sub{font-size:18px;opacity:.8;margin-bottom:30px;}
        .name{font-size:36px;font-weight:900;margin:12px 0;}
        .badge{font-size:20px;margin-top:18px;}
        .row{display:flex;align-items:center;gap:20px;margin-top:20px;}
        .avatar{width:140px;height:140px;border-radius:18px;overflow:hidden;border:4px solid rgba(0,0,0,.12);display:grid;place-items:center;background:#eef8ff;}
        .footer{margin-top:30px;opacity:.85;}
        .stars{font-size:20px;margin-top:10px;}
      </style>
    </head>
    <body>
      <div class="cert">
        <h1>🌍 Eco Hero Certificate</h1>
        <div class="sub">Awarded for completing Eco Quest missions</div>

        <div class="row">
          <div class="avatar">${renderAvatarSVG(s.avatar, s.stars, 140)}</div>
          <div>
            <div><b>Class:</b> ${escapeHtml(cls)}</div>
            <div class="name">${escapeHtml(s.name)}</div>
            <div class="stars">⭐ Stars: <b>${s.stars}</b></div>
            <div class="badge">🏅 Badge: <b>${escapeHtml(badge)}</b></div>
          </div>
        </div>

        <div class="footer">
          Date: ${escapeHtml(dateStr)}<br/>
          Keep making planet-friendly choices! 💚
        </div>
      </div>
      <script>
        window.onload = () => setTimeout(() => window.print(), 400);
      </script>
    </body>
    </html>
  `);
  w.document.close();
}

/* ==========================
   Home text
========================== */
function initHomeText() {
  const qw = $("#quickWin");
  const sh = $("#storyHook");
  if (qw) qw.textContent = pick(quickWins);
  if (sh) sh.textContent = pick(storyHooks);
}

/* ==========================
   Universal event delegation
   (This is the key fix if your IDs are different or buttons are created later.)
========================== */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t) return;

  // Save/Create Avatar (lots of fallbacks)
  const saveBtn = t.closest(
    "#btnSaveAvatar, #btnCreateAvatar, #createAvatar, #create-avatar, .btnSaveAvatar, .btnCreateAvatar, [data-action='saveAvatar'], [data-action='createAvatar']"
  );
  if (saveBtn) {
    e.preventDefault();
    console.log("✅ Avatar save clicked (delegation)", saveBtn);
    try { saveAvatar(); } catch (err) { console.error(err); toast("Avatar save error — check console"); }
    return;
  }

  // Open avatar builder
  const openBtn = t.closest(
    "#btnOpenAvatar, #openAvatar, #open-avatar, .btnOpenAvatar, [data-action='openAvatar']"
  );
  if (openBtn) {
    e.preventDefault();
    console.log("✅ Avatar open clicked (delegation)", openBtn);
    try { openAvatarModal(); } catch (err) { console.error(err); toast("Avatar open error — check console"); }
    return;
  }

  // Close avatar modal
  const closeBtn = t.closest(
    "#btnCloseAvatar, #closeAvatar, #close-avatar, .btnCloseAvatar, [data-action='closeAvatar'], [data-close='1']"
  );
  if (closeBtn) {
    e.preventDefault();
    closeAvatarModal();
    return;
  }

  // Random hero
  const randBtn = t.closest(
    "#btnRandomHero, #randomHero, #random-hero, .btnRandomHero, [data-action='randomHero']"
  );
  if (randBtn) {
    e.preventDefault();
    randomHero();
    return;
  }
});

// Live preview updates (delegation for input/change)
document.addEventListener("input", (e) => {
  const id = e.target?.id;
  if (!id) return;
  const watched = new Set([
    "heroDisplayName", "skinTone", "bodyShape", "pose", "outline",
    "eyes", "mouth", "cheeks", "hairStyle", "hairColor",
    "outfit", "outfitColor", "hat", "accessory", "sidekick"
  ]);
  if (watched.has(id)) {
    updateAvatarBuilderUI();
    renderAvatarBuilderPreview();
  }
});

document.addEventListener("change", (e) => {
  const id = e.target?.id;
  if (!id) return;
  const watched = new Set([
    "heroDisplayName", "skinTone", "bodyShape", "pose", "outline",
    "eyes", "mouth", "cheeks", "hairStyle", "hairColor",
    "outfit", "outfitColor", "hat", "accessory", "sidekick"
  ]);
  if (watched.has(id)) {
    updateAvatarBuilderUI();
    renderAvatarBuilderPreview();
  }
});

/* ==========================
   Init
========================== */
function init() {
  load();

  document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";

  initHomeText();
  updateHUD();
  renderHomeAvatar();
  renderFacts();
  renderMap();

  // Tabs
  $$(".tab").forEach(btn => on(btn, "click", () => setScreen(btn.dataset.screen)));

  // Home shortcuts
  on($("#btnGoMap"), "click", () => setScreen("map"));
  on($("#btnStartQuest"), "click", () => setScreen("map"));

  on($("#btnHow"), "click", () => {
    const panel = $("#howPanel");
    if (panel) panel.hidden = !panel.hidden;
  });

  on($("#btnRead"), "click", () => {
    state.readAloud = !state.readAloud;
    save();
    updateHUD();
    toast(`Read Aloud ${state.readAloud ? "On" : "Off"}`);
  });

  on($("#btnResetAll"), "click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.students = [makeStudent("guest", "Guest")];
    state.activeStudentId = "guest";
    state.className = "";
    state.teacherMission = "all";
    state.readAloud = false;
    state.projectorMode = false;
    save();
    updateHUD();
    renderHomeAvatar();
    renderMap();
    toast("Reset complete ✅");
    setScreen("home");
  });

  // Modal outside-click close support (if your HTML uses data-close="1")
  const modal = avatarModalEl();
  if (modal) {
    on(modal, "click", (e) => {
      if (e.target?.dataset?.close === "1") closeAvatarModal();
    });
  }

  // Default screen
  setScreen("home");

  // Expose helpers for debugging
  window.EcoQuest = {
    state,
    openAvatarModal,
    closeAvatarModal,
    saveAvatar,
    randomHero,
    renderHomeAvatar
  };

  console.log("✅ init complete");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
