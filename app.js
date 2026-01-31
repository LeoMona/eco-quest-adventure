/* Eco Quest Adventure — Cartoon Adventure Edition (Front-end only)
   FIXED + FULL VERSION
   ------------------------------------------------------------
   Features:
   - Story-based quests with biomes (Forest -> Ocean -> City)
   - Animated travel path on the map + clickable hotspots
   - Advanced Avatar Builder (Home)
   - Unlockables tied to stars
   - Teacher dashboard: class, mission restriction, students, CSV export
   - Printable certificate

   Notes:
   - Data stored in localStorage on this device only.
*/

// ---------- Helpers
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const STORAGE_KEY = "ecoQuestAdventure_cartoon_v2";

// ---------- Data: badges + tips + facts
const badges = [
  { name: "Seedling Saver",  stars: 5,  icon: "🌱" },
  { name: "Super Recycler",  stars: 12, icon: "♻️" },
  { name: "Energy Guardian", stars: 20, icon: "💡" },
  { name: "Planet Pal",      stars: 30, icon: "🌍" },
];

const quickWins = [
  "Turn off the tap while brushing teeth 💧",
  "Use a reusable bottle 🥤",
  "Switch off lights when leaving a room 💡",
  "Walk or cycle for short trips 🚶‍♀️🚲",
  "Reuse paper for drawing 📝",
];

const storyHooks = [
  "Captain Carbon spilled glitter-trash (seriously?!)… Go save the forest! 🌲✨",
  "Plastic is floating to the ocean… Tara the Turtle needs help! 🌊🐢",
  "The city is wasting energy… Time for your power-down super skills! 🏙️💡",
];

const facts = [
  { emoji: "🌞", q: "Why is Earth getting warmer?", a: "Some gases act like a warm blanket around Earth. Too many makes it hotter." },
  { emoji: "♻️", q: "What does recycle mean?", a: "Recycling turns old things into new things so we make less trash." },
  { emoji: "💡", q: "Why save electricity?", a: "Making electricity can create pollution. Using less helps keep air cleaner." },
  { emoji: "🚲", q: "What travel is greener?", a: "Walking, cycling, buses, and trains often make less pollution per person." },
  { emoji: "🌳", q: "Why are trees important?", a: "Trees help clean the air and provide homes for animals." },
  { emoji: "💧", q: "Why save water?", a: "Clean water is precious. Saving it helps people, animals, and nature." },
];

// ---------- State
const state = {
  screen: "home",
  readAloud: false,
  projectorMode: false,
  className: "",
  teacherMission: "all", // all | forest | ocean | city
  activeStudentId: "guest",
  students: [],

  // Quest runtime
  currentBiomeId: null,
  sceneIndex: 0,
  questScenes: [],

  // Mini-game runtime
  sorter: { remaining: 0, selectedItemId: null, done: false },
  energy:  { timeLeft: 20, timerId: null, devices: [], done: false },
  travel:  { answered: false, done: false },
};

// ---------- Students & Storage
function defaultAvatar(){
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
    sidekick: "none",
  };
}

function makeStudent(id, name){
  return {
    id,
    name,
    stars: 0,
    score: 0,
    biomeProgress: { forest:false, ocean:false, city:false },
    avatar: defaultAvatar(),
    updatedAt: Date.now(),
  };
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      state.students = [ makeStudent("guest","Guest") ];
      return;
    }
    const saved = JSON.parse(raw);
    state.readAloud = saved.readAloud ?? false;
    state.projectorMode = saved.projectorMode ?? false;
    state.className = saved.className ?? "";
    state.teacherMission = saved.teacherMission ?? "all";
    state.activeStudentId = saved.activeStudentId ?? "guest";
    state.students = saved.students ?? [ makeStudent("guest","Guest") ];
    if(!state.students.find(s => s.id === "guest")) state.students.push(makeStudent("guest","Guest"));
  }catch(e){
    state.students = [ makeStudent("guest","Guest") ];
  }
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    readAloud: state.readAloud,
    projectorMode: state.projectorMode,
    className: state.className,
    teacherMission: state.teacherMission,
    activeStudentId: state.activeStudentId,
    students: state.students,
  }));
}

function activeStudent(){
  return state.students.find(s => s.id === state.activeStudentId) || state.students[0];
}

function computeBadge(stars){
  const unlocked = badges.filter(b => stars >= b.stars);
  return unlocked.length ? unlocked[unlocked.length-1].name : "—";
}

// ---------- UI helpers
function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function speak(text){
  if(!state.readAloud) return;
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.08;
    window.speechSynthesis.speak(u);
  }catch(e){}
}

// ---------- Navigation / HUD
function setScreen(screen){
  state.screen = screen;
  $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.screen === screen));
  ["home","map","quest","learn","teacher"].forEach(s => {
    const el = $(`#screen-${s}`);
    if(el) el.classList.toggle("active", s === screen);
  });

  if(screen === "map") renderMap();
  if(screen === "learn") renderFacts();
  if(screen === "teacher") renderTeacher();
  if(screen === "home") renderHomeAvatar();
  if(screen === "quest") renderScene();
}

function updateHUD(){
  const p = activeStudent();
  const hudPlayer = $("#hudPlayer");
  const hudStars  = $("#hudStars");
  const hudBadge  = $("#hudBadge");
  if(hudPlayer) hudPlayer.textContent = p.name;
  if(hudStars)  hudStars.textContent = `⭐ ${p.stars}`;
  if(hudBadge)  hudBadge.textContent = computeBadge(p.stars);

  const btnRead = $("#btnRead");
  if(btnRead){
    btnRead.textContent = `🔊 Read Aloud: ${state.readAloud ? "On" : "Off"}`;
    btnRead.setAttribute("aria-pressed", String(state.readAloud));
  }

  const missionText = state.teacherMission === "all" ? "Full Adventure" :
                      state.teacherMission === "forest" ? "Forest Only" :
                      state.teacherMission === "ocean"  ? "Ocean Only"  : "City Only";
  const pill = $("#missionLockPill");
  if(pill) pill.textContent = `Teacher Mission: ${missionText}`;
}

// ---------- Avatar options + unlock logic
const avatarOptions = {
  skin: [
    { id:"cool1", label:"Cool 1", color:"#f8d7c0" },
    { id:"cool2", label:"Cool 2", color:"#f2c3a2" },
    { id:"warm1", label:"Warm 1", color:"#f6c7a8" },
    { id:"warm2", label:"Warm 2", color:"#eab08c" },
    { id:"tan1",  label:"Tan 1",  color:"#d99b6c" },
    { id:"deep1", label:"Deep 1", color:"#b8754c" },
    { id:"deep2", label:"Deep 2", color:"#8c5636" },
  ],
  body: [
    { id:"small",   label:"Small" },
    { id:"regular", label:"Regular" },
    { id:"tall",    label:"Tall" },
    { id:"round",   label:"Round" },
  ],
  pose: [
    { id:"wave", label:"Wave 👋" },
    { id:"hero", label:"Hero Pose 🦸" },
    { id:"peace",label:"Peace ✌️" },
    { id:"jump", label:"Jump ✨" },
  ],
  outline: [
    { id:"dark",  label:"Dark Outline" },
    { id:"light", label:"Light Outline" },
  ],
  eyes: [
    { id:"happy",   label:"Happy 😊" },
    { id:"sparkle", label:"Sparkle ✨" },
    { id:"focused", label:"Focused 😎" },
    { id:"sleepy",  label:"Sleepy 😴" },
  ],
  mouth: [
    { id:"smile",  label:"Smile 🙂" },
    { id:"biggrin",label:"Big Grin 😁" },
    { id:"ooh",    label:"Ooh! 😮" },
    { id:"brave",  label:"Brave 😤" },
  ],
  cheeks: [
    { id:"none",     label:"None" },
    { id:"blush",    label:"Blush 💗" },
    { id:"freckles", label:"Freckles ✴️" },
  ],
  hairStyle: [
    { id:"spiky", label:"Spiky" },
    { id:"curly", label:"Curly" },
    { id:"bob",   label:"Bob Cut" },
    { id:"pony",  label:"Ponytail" },
  ],
  hairColor: [
    { id:"black",  label:"Black",  color:"#1b1b1b" },
    { id:"brown",  label:"Brown",  color:"#4a2c1a" },
    { id:"blonde", label:"Blonde", color:"#d9b35e" },
    { id:"blue",   label:"Blue",   color:"#2f74ff" },
    { id:"pink",   label:"Pink",   color:"#ff4fa1" },
    { id:"green",  label:"Green",  color:"#2fd985" },
  ],
  outfit: [
    { id:"ranger", label:"Forest Ranger 🎒" },
    { id:"diver",  label:"Ocean Explorer 🫧" },
    { id:"hero",   label:"City Eco Hero 🦸" },
    { id:"casual", label:"Casual Tee 👕" },
  ],
  outfitColor: [
    { id:"green",  label:"Green",  color:"#35e09a" },
    { id:"blue",   label:"Blue",   color:"#59b7ff" },
    { id:"yellow", label:"Yellow", color:"#ffd44d" },
    { id:"pink",   label:"Pink",   color:"#ff6aa6" },
    { id:"orange", label:"Orange", color:"#ff9a3c" },
  ],
  hat: [
    { id:"none",      label:"None (free)",           req:0  },
    { id:"cap_leaf",  label:"Leaf Cap 🍃 (⭐5)",     req:5  },
    { id:"hat_ocean", label:"Ocean Cap 🐬 (⭐12)",   req:12 },
    { id:"hat_city",  label:"City Beanie 🧢 (⭐20)", req:20 },
    { id:"hat_crown", label:"Planet Crown 👑 (⭐30)",req:30 },
  ],
  accessory: [
    { id:"none",        label:"None (free)",          req:0  },
    { id:"acc_magnify", label:"Magnifier 🔍 (⭐5)",   req:5  },
    { id:"acc_badge",   label:"Eco Badge 🏅 (⭐12)",  req:12 },
    { id:"acc_cape",    label:"Hero Cape 🦸 (⭐20)",  req:20 },
    { id:"acc_glow",    label:"Glow Aura ✨ (⭐30)",  req:30 },
  ],
  sidekick: [
    { id:"none",        label:"None (free)",        req:0  },
    { id:"side_owl",    label:"Ollie 🦉 (⭐5)",      req:5  },
    { id:"side_turtle", label:"Tara 🐢 (⭐12)",      req:12 },
    { id:"side_crab",   label:"Coach 🦀 (⭐20)",     req:20 },
    { id:"side_bot",    label:"MiniBot 🤖 (⭐30)",   req:30 },
  ],
};

function canUseOption(option, stars){
  if(!option || option.req == null) return true;
  return stars >= option.req;
}

function populateSelect(id, list){
  const sel = $(id);
  if(!sel) return;
  sel.innerHTML = "";
  list.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    sel.appendChild(o);
  });
}

function setSelectValue(id, value){
  const sel = $(id);
  if(!sel || !sel.options?.length) return;
  const exists = [...sel.options].some(o => o.value === value);
  sel.value = exists ? value : sel.options[0].value;
}

// ---------- Avatar rendering (SVG layered)
function renderAvatarSVG(config, stars=0, size=280){
  const skin    = avatarOptions.skin.find(x=>x.id===config.skin)?.color ?? "#eab08c";
  const hair    = avatarOptions.hairColor.find(x=>x.id===config.hairColor)?.color ?? "#1b1b1b";
  const outfit  = avatarOptions.outfitColor.find(x=>x.id===config.outfitColor)?.color ?? "#35e09a";
  const outline = config.outline === "light" ? "#ffffff" : "#061228";

  const bodyScale = config.body === "small" ? 0.92 :
                    config.body === "tall"  ? 1.05 :
                    config.body === "round" ? 1.00 : 1.0;
  const belly = config.body === "round" ? 58 : 52;

  const pose = config.pose;
  const armL = pose === "wave"  ? "rotate(-18 92 160)" :
               pose === "peace" ? "rotate(-8  92 160)" :
               pose === "hero"  ? "rotate(-28 92 160)" : "rotate(-8 92 160)";
  const armR = pose === "wave"  ? "rotate(28 188 160)" :
               pose === "peace" ? "rotate(38 188 160)" :
               pose === "hero"  ? "rotate(10 188 160)" : "rotate(10 188 160)";

  const jump = pose === "jump" ? "translate(0,-10)" : "";

  const eyes = (() => {
    if(config.eyes === "sparkle"){
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
    if(config.eyes === "focused"){
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
    if(config.eyes === "sleepy"){
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
    if(config.mouth === "biggrin") return `<path d="M136 146 q24 22 48 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
    if(config.mouth === "ooh")    return `<circle cx="160" cy="150" r="10" fill="#fff" stroke="${outline}" stroke-width="6"/>`;
    if(config.mouth === "brave")  return `<path d="M142 152 q18 -12 36 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
    return `<path d="M140 150 q20 18 40 0" fill="none" stroke="${outline}" stroke-width="7" stroke-linecap="round"/>`;
  })();

  const cheeks = (() => {
    if(config.cheeks === "blush"){
      return `<g opacity=".55">
        <ellipse cx="108" cy="138" rx="10" ry="6" fill="#ff6aa6"/>
        <ellipse cx="212" cy="138" rx="10" ry="6" fill="#ff6aa6"/>
      </g>`;
    }
    if(config.cheeks === "freckles"){
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
    if(config.hairStyle === "curly"){
      return `<path d="M92 92 q25 -40 68 -36 q48 -4 72 36
        q-8 20 -18 26 q-14 -12 -20 -2 q-12 -14 -22 -4 q-10 -12 -20 -2 q-14 -12 -26 -2 q-10 -8 -14 -16z"
        fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
    }
    if(config.hairStyle === "bob"){
      return `<path d="M92 94 q18 -54 68 -52 q54 -2 78 52
        q-8 46 -18 58 q-42 10 -80 0 q-20 -14 -48 -58z"
        fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
    }
    if(config.hairStyle === "pony"){
      return `<g>
        <path d="M92 94 q20 -54 68 -52 q56 -2 78 52 q-6 28 -14 36 q-44 10 -88 0 q-22 -14 -44 -36z"
          fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>
        <path d="M230 110 q40 10 30 44 q-10 36 -48 26" fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>
        <path d="M230 110 q40 10 30 44 q-10 36 -48 26" fill="none" stroke="${hair}" stroke-width="7" stroke-linecap="round"/>
      </g>`;
    }
    return `<path d="M90 98 l16 -34 l18 26 l20 -38 l18 30 l22 -40 l16 34 l16 -22 l16 42
      q-18 36 -76 34 q-62 2 -66 -32z"
      fill="${hair}" stroke="${outline}" stroke-width="6" stroke-linejoin="round"/>`;
  })();

  const outfitShape = (() => {
    if(config.outfit === "diver"){
      return `
        <path d="M110 210 q50 -25 100 0 q-10 62 -50 74 q-40 -12 -50 -74z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <circle cx="160" cy="230" r="10" fill="#fff" stroke="${outline}" stroke-width="6"/>
        <path d="M135 250 q25 18 50 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      `;
    }
    if(config.outfit === "hero"){
      return `
        <path d="M110 210 q50 -30 100 0 q-10 66 -50 78 q-40 -12 -50 -78z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <path d="M160 214 l10 18 l20 2 l-14 14 l4 20 l-20 -10 l-20 10 l4 -20 l-14 -14 l20 -2z"
          fill="#ffd44d" stroke="${outline}" stroke-width="5"/>
      `;
    }
    if(config.outfit === "casual"){
      return `
        <path d="M112 212 q48 -26 96 0 q-10 62 -48 76 q-38 -14 -48 -76z"
          fill="${outfit}" stroke="${outline}" stroke-width="6"/>
        <path d="M132 232 h56" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      `;
    }
    return `
      <path d="M110 210 q50 -30 100 0 q-10 66 -50 78 q-40 -12 -50 -78z"
        fill="${outfit}" stroke="${outline}" stroke-width="6"/>
      <path d="M130 230 q30 26 60 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      <path d="M148 210 v78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
      <path d="M172 210 v78" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".9"/>
    `;
  })();

  const hatLayer = (() => {
    const ok = (req) => stars >= req;
    if(config.hat === "cap_leaf" && ok(5)){
      return `<path d="M104 90 q56 -44 112 0 q-10 18 -18 18 q-38 -14 -76 0 q-10 0 -18 -18z"
        fill="#35e09a" stroke="${outline}" stroke-width="6"/>`;
    }
    if(config.hat === "hat_ocean" && ok(12)){
      return `<path d="M104 90 q56 -44 112 0 q-10 18 -18 18 q-38 -14 -76 0 q-10 0 -18 -18z"
        fill="#59b7ff" stroke="${outline}" stroke-width="6"/>`;
    }
    if(config.hat === "hat_city" && ok(20)){
      return `<path d="M106 80 q54 -40 108 0 v22 q-54 18 -108 0z"
        fill="#1f2a48" stroke="${outline}" stroke-width="6"/>`;
    }
    if(config.hat === "hat_crown" && ok(30)){
      return `<path d="M108 94 l16 -20 l16 18 l20 -26 l20 26 l16 -18 l16 20 v16 q-52 20 -104 0z"
        fill="#ffd44d" stroke="${outline}" stroke-width="6"/>`;
    }
    return "";
  })();

  const accessoryLayer = (() => {
    const ok = (req) => stars >= req;
    if(config.accessory === "acc_magnify" && ok(5)){
      return `<g>
        <circle cx="220" cy="176" r="16" fill="rgba(255,255,255,.18)" stroke="${outline}" stroke-width="6"/>
        <path d="M232 188 l18 18" stroke="${outline}" stroke-width="8" stroke-linecap="round"/>
        <path d="M232 188 l18 18" stroke="#59b7ff" stroke-width="5" stroke-linecap="round"/>
      </g>`;
    }
    if(config.accessory === "acc_badge" && ok(12)){
      return `<g>
        <circle cx="124" cy="238" r="14" fill="#ffd44d" stroke="${outline}" stroke-width="6"/>
        <text x="124" y="244" text-anchor="middle" font-size="16">🏅</text>
      </g>`;
    }
    if(config.accessory === "acc_cape" && ok(20)){
      return `<path d="M206 206 q54 40 22 108" fill="none" stroke="${outline}" stroke-width="10" stroke-linecap="round"/>
              <path d="M206 206 q54 40 22 108" fill="none" stroke="#ff6aa6" stroke-width="7" stroke-linecap="round"/>`;
    }
    if(config.accessory === "acc_glow" && ok(30)){
      return `<g opacity=".35">
        <circle cx="160" cy="170" r="128" fill="none" stroke="#ffd44d" stroke-width="10"/>
        <circle cx="160" cy="170" r="112" fill="none" stroke="#35e09a" stroke-width="10"/>
      </g>`;
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

    if(config.sidekick === "side_owl" && ok(5))    return bubble("🦉");
    if(config.sidekick === "side_turtle" && ok(12)) return bubble("🐢");
    if(config.sidekick === "side_crab" && ok(20))   return bubble("🦀");
    if(config.sidekick === "side_bot" && ok(30))    return bubble("🤖");
    return "";
  })();

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 320 320">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="6" flood-color="rgba(0,0,0,.35)"/>
        </filter>
      </defs>
      <g transform="${jump} scale(${bodyScale}) translate(${(1-bodyScale)*160}, ${(1-bodyScale)*160})" filter="url(#shadow)">
        <circle cx="160" cy="128" r="78" fill="${skin}" stroke="${outline}" stroke-width="8"/>
        ${hairPath}
        ${hatLayer}
        ${eyes}
        ${cheeks}
        ${mouth}
        ${outfitShape}
        ${accessoryLayer}

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

// ---------- Home avatar
function renderHomeAvatar(){
  const p = activeStudent();
  const box = $("#homeAvatarPreview");
  const hint = $("#homeAvatarHint");
  const name = $("#homeAvatarName");
  if(!box) return;
  box.innerHTML = renderAvatarSVG(p.avatar, p.stars, 240);
  if(name) name.textContent = p.avatar.displayName || "Eco Hero";
  if(hint) hint.textContent = `Stars unlock gear: ⭐5, ⭐12, ⭐20, ⭐30. You have ⭐ ${p.stars}.`;
}

// ---------- Avatar modal open/close
function openAvatarModal(){
  const modal = $("#avatarModal");
  if(!modal) return;
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const p = activeStudent();
  const a = p.avatar;

  populateSelect("#skinTone",    avatarOptions.skin);
  populateSelect("#bodyShape",  avatarOptions.body);
  populateSelect("#pose",       avatarOptions.pose);
  populateSelect("#outline",    avatarOptions.outline);
  populateSelect("#eyes",       avatarOptions.eyes);
  populateSelect("#mouth",      avatarOptions.mouth);
  populateSelect("#cheeks",     avatarOptions.cheeks);
  populateSelect("#hairStyle",  avatarOptions.hairStyle);
  populateSelect("#hairColor",  avatarOptions.hairColor);
  populateSelect("#outfit",     avatarOptions.outfit);
  populateSelect("#outfitColor",avatarOptions.outfitColor);
  populateSelect("#hat",        avatarOptions.hat);
  populateSelect("#accessory",  avatarOptions.accessory);
  populateSelect("#sidekick",   avatarOptions.sidekick);

  const heroDisplayName = $("#heroDisplayName");
  if(heroDisplayName) heroDisplayName.value = a.displayName ?? "Eco Hero";

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

function closeAvatarModal(){
  const modal = $("#avatarModal");
  if(modal) modal.hidden = true;
  document.body.style.overflow = "";
}

function updateAvatarBuilderUI(){
  const p = activeStudent();
  const stars = p.stars;

  // progress
  const max = 30;
  const pct = Math.min(100, Math.round((stars/max)*100));
  const fill = $("#unlockFill");
  const txt  = $("#unlockText");
  if(fill) fill.style.width = pct + "%";
  if(txt)  txt.textContent = `${stars} / ${max} ⭐`;

  // lock options
  ["#hat", "#accessory", "#sidekick"].forEach(selId => {
    const sel = $(selId);
    if(!sel) return;
    const list = selId==="#hat" ? avatarOptions.hat : selId==="#accessory" ? avatarOptions.accessory : avatarOptions.sidekick;

    [...sel.options].forEach(o => {
      const opt = list.find(x => x.id === o.value);
      const ok = canUseOption(opt, stars);
      o.disabled = !ok;
      o.textContent = opt.label + (ok ? "" : " 🔒");
    });

    const currentOpt = list.find(x => x.id === sel.value);
    if(currentOpt && !canUseOption(currentOpt, stars)) sel.value = "none";
  });

  const hint = $("#unlockHint");
  if(hint) hint.textContent = stars >= 30 ? "MAX POWER! You unlocked the top gear! 👑✨" : "Earn ⭐ to unlock cool gear! (5 / 12 / 20 / 30)";
}

function readAvatarFromUI(){
  const p = activeStudent();
  const stars = p.stars;
  const a = { ...p.avatar };

  a.displayName = (( $("#heroDisplayName")?.value ) || "Eco Hero").trim().slice(0, 18);
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

  const hatVal = $("#hat")?.value || "none";
  const hatOpt = avatarOptions.hat.find(x => x.id === hatVal);
  a.hat = canUseOption(hatOpt, stars) ? hatVal : "none";

  const accVal = $("#accessory")?.value || "none";
  const accOpt = avatarOptions.accessory.find(x => x.id === accVal);
  a.accessory = canUseOption(accOpt, stars) ? accVal : "none";

  const sideVal = $("#sidekick")?.value || "none";
  const sideOpt = avatarOptions.sidekick.find(x => x.id === sideVal);
  a.sidekick = canUseOption(sideOpt, stars) ? sideVal : "none";

  return a;
}

function renderAvatarBuilderPreview(){
  const p = activeStudent();
  const cfg = readAvatarFromUI();
  const prev = $("#avatarPreview");
  if(prev) prev.innerHTML = renderAvatarSVG(cfg, p.stars, 320);
}

function saveAvatar(){
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

function randomHero(){
  const p = activeStudent();
  const stars = p.stars;
  const rand = (arr) => arr[Math.floor(Math.random()*arr.length)].id;

  const chooseUnlock = (arr) => {
    const ok = arr.filter(o => canUseOption(o, stars));
    const pool = ok.length ? ok : arr.filter(o => o.id === "none");
    return pool[Math.floor(Math.random() * (pool.length || 1))].id;
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
    sidekick: chooseUnlock(avatarOptions.sidekick),
  };

  const heroDisplayName = $("#heroDisplayName");
  if(heroDisplayName) heroDisplayName.value = cfg.displayName;

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

// ---------- Biomes + quests
const BIOMES = [
  { id:"forest", name:"Forest", icon:"🌲", unlocks:null,   desc:"Help animals and keep the forest clean!" },
  { id:"ocean",  name:"Ocean",  icon:"🌊", unlocks:"forest", desc:"Stop plastic and protect sea friends!" },
  { id:"city",   name:"City",   icon:"🏙️", unlocks:"ocean",  desc:"Save energy and clean city air!" },
];

function story(avatar, who, text, why){
  return { type:"story", avatar, who, text, why };
}
function game(kind, payload){
  return { type:kind, payload };
}

function biomeScenes(biomeId, playerName){
  if(biomeId === "forest"){
    return [
      story("🤖","EcoBot",`Pssst, ${playerName}! Captain Carbon dropped glitter-trash in the forest. Glitter?! Really?! 😂`,
            "Keeping forests clean helps animals and nature."),
      story("😂","Captain Carbon","Mwahaha! I made a Trash Tornado! …Wait, why is it spinning into my pants?! WHOOPS!",
            "Trash can hurt wildlife. Sorting helps reduce waste."),
      game("sorter",{ theme:"forest" }),
      story("🦉","Ollie the Owl","Hoot-hoot! You sorted like a superstar! Now… how should we travel to the ranger station?",
            "Cleaner travel means less pollution."),
      game("travel",{ theme:"forest" }),
      story("🦌","Dara the Deer","Yay! One more mission: the cabin gadgets are buzzing. Turn off what’s not needed!",
            "Saving electricity reduces pollution."),
      game("energy",{ theme:"forest" }),
      story("🌟","Narrator","FOREST SAVED! A shiny travel line appears… Next stop: the Ocean! 🌊✨",
            "Great choices can unlock new adventures!"),
    ];
  }
  if(biomeId === "ocean"){
    return [
      story("🤖","EcoBot",`Splash alert, ${playerName}! Plastic is drifting into the sea. Tara the Turtle is not amused 🐢`,
            "Less plastic means safer oceans."),
      story("🐢","Tara the Turtle","I like seaweed… not plastic. Let’s fix it together!",
            "Sorting keeps plastic out of oceans."),
      game("sorter",{ theme:"ocean" }),
      story("🦀","Crab Coach","SNAP-SNAP! Time to choose a clean way to deliver a message on the beach!",
            "Green travel reduces pollution."),
      game("travel",{ theme:"ocean" }),
      story("😂","Captain Carbon","I turned on ALL the sea-lab screens! Because… um… I like glowing rectangles!",
            "Turning off unused devices saves energy."),
      game("energy",{ theme:"ocean" }),
      story("🌟","Narrator","OCEAN SPARKLES! A new travel line appears… Next stop: the City! 🏙️✨",
            "You’re becoming a climate champion!"),
    ];
  }
  return [
    story("🤖","EcoBot",`City mission, ${playerName}! Captain Carbon left everything ON again… even the neon donut sign 🍩✨`,
          "Saving energy can reduce pollution."),
    story("🏙️","Mayor Green","Welcome, Eco Hero! Let’s power down smartly and keep our air clean!",
          "Clean air helps everyone stay healthy."),
    game("energy",{ theme:"city" }),
    story("😂","Captain Carbon","Cars! Traffic! Honk-honk! I call it… the Pollution Parade! (It’s not a good parade.)",
          "Choosing greener travel lowers pollution."),
    game("travel",{ theme:"city" }),
    story("♻️","Recycling Crew","Final mission: sort city trash correctly so we can recycle more!",
          "Recycling saves resources and reduces waste."),
    game("sorter",{ theme:"city" }),
    story("🏆","Narrator","ALL BIOMES COMPLETE! You are officially an Eco Hero legend! 🌍💚",
          "Keep using these habits in real life!"),
  ];
}

function biomeUnlocked(biomeId){
  const b = BIOMES.find(x => x.id === biomeId);
  if(!b) return false;
  if(!b.unlocks) return true;
  return Boolean(activeStudent().biomeProgress[b.unlocks]);
}

function biomeComplete(biomeId){
  return Boolean(activeStudent().biomeProgress[biomeId]);
}

function missionAllows(biomeId){
  if(state.teacherMission === "all") return true;
  return state.teacherMission === biomeId;
}

// ---------- MAP
function renderMap(){
  const stage = $("#mapStage");
  if(!stage) return;
  const p = activeStudent();
  updateHUD();

  const oceanUnlocked = biomeUnlocked("ocean");
  const cityUnlocked  = biomeUnlocked("city");
  const forestDone = biomeComplete("forest");
  const oceanDone  = biomeComplete("ocean");
  const cityDone   = biomeComplete("city");

  const nodes = {
    forest: { x: 140, y: 260 },
    ocean:  { x: 380, y: 150 },
    city:   { x: 650, y: 220 },
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

      <!-- Paths -->
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

      <!-- EcoBot moving along unlocked line -->
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

      <!-- Player badge -->
      <g transform="translate(20,20)" filter="url(#soft)">
        <rect x="0" y="0" width="210" height="86" rx="18" fill="rgba(0,0,0,.20)" stroke="rgba(255,255,255,.18)" stroke-width="4"/>
        <foreignObject x="10" y="10" width="66" height="66">
          <div xmlns="http://www.w3.org/1999/xhtml"
               style="width:66px;height:66px;border-radius:16px;overflow:hidden;border:4px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);display:grid;place-items:center;">
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

function renderBiomeNode(id, x, y, unlocked, complete){
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

function addBiomeHotspots(stage, nodes){
  const overlay = stage.querySelector(".mapButtons");
  if(!overlay) return;
  overlay.innerHTML = "";

  const viewW = 820, viewH = 360;
  const w = stage.clientWidth;
  const h = stage.clientHeight;
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
    btn.style.top  = (pos.y * sy - 70) + "px";
    btn.style.width  = "140px";
    btn.style.height = "140px";
    btn.style.borderRadius = "30px";
    btn.style.border = "0";
    btn.style.background = "transparent";
    btn.style.cursor = unlocked ? "pointer" : "not-allowed";

    btn.setAttribute("aria-label", `${b.name} biome. ${unlocked ? "Unlocked" : "Locked"}. ${complete ? "Completed" : ""}`);

    btn.addEventListener("click", () => {
      if(!unlocked){
        toast("Locked! Finish the previous biome first 🔒");
        speak("Locked. Finish the previous biome first.");
        return;
      }
      if(!allowed){
        toast("Teacher mission restricts this biome today 🎯");
        speak("Teacher mission restricts this biome today.");
        return;
      }
      startBiomeQuest(b.id);
    });

    overlay.appendChild(btn);
  });
}

// ---------- Quest flow
function resetMiniGameFlags(){
  state.sorter = { remaining: 0, selectedItemId: null, done: false };
  state.energy  = { timeLeft: 20, timerId: null, devices: [], done: false };
  state.travel  = { answered: false, done: false };
}

function startBiomeQuest(biomeId){
  const p = activeStudent();
  state.currentBiomeId = biomeId;
  state.sceneIndex = 0;
  state.questScenes = biomeScenes(biomeId, p.name);
  resetMiniGameFlags();

  toast(`${BIOMES.find(b => b.id === biomeId)?.name} quest started! 🎒`);
  speak("Quest started.");

  setScreen("quest");
  renderScene();
}

function currentScene(){
  return state.questScenes[state.sceneIndex] || null;
}

function renderScene(){
  updateHUD();

  const scene = currentScene();
  const title = $("#questTitle");
  const step  = $("#questStep");
  const dlgAvatar = $("#dlgAvatar");
  const dlgWho    = $("#dlgWho");
  const dlgText   = $("#dlgText");
  const why       = $("#whyItMatters");
  const area      = $("#gameArea");

  const b = BIOMES.find(x => x.id === state.currentBiomeId);
  if(title) title.textContent = b ? `${b.icon} ${b.name} Quest` : "Quest";
  if(step)  step.textContent  = `Scene ${state.sceneIndex + 1}`;

  if(!scene){
    if(dlgWho)  dlgWho.textContent = "EcoBot";
    if(dlgText) dlgText.textContent = "Choose a biome on the World Map to begin!";
    if(dlgAvatar) dlgAvatar.textContent = "🤖";
    if(why) why.textContent = "Your choices can help forests, oceans, and cities!";
    if(area) area.innerHTML = `<div class="emptyState"><div class="bigText">Pick a biome on the World Map 🗺️</div><p class="small">Your quest will appear here.</p></div>`;
    return;
  }

  // Dialogue box
  if(dlgAvatar) dlgAvatar.textContent = scene.avatar || "🤖";
  if(dlgWho)    dlgWho.textContent = scene.who || "EcoBot";
  if(dlgText)   dlgText.textContent = scene.text || "";
  if(why)       why.textContent = scene.why || "";

  speak(`${scene.who || ""}. ${scene.text || ""}`.trim());

  // Quest navigation buttons
  const btnBack = $("#btnQuestBack");
  const btnNext = $("#btnQuestNext");
  if(btnBack) btnBack.disabled = state.sceneIndex === 0;

  // Game area
  if(!area) return;

  if(scene.type === "story"){
    area.innerHTML = `
      <div class="emptyState">
        <div class="bigText">Story Moment 📖</div>
        <p class="small">Read the scene, then press <b>Next</b>.</p>
      </div>
    `;
    if(btnNext) btnNext.disabled = false;
    return;
  }

  if(scene.type === "sorter"){
    renderWasteSorter(scene.payload?.theme || "forest");
    if(btnNext) btnNext.disabled = !state.sorter.done;
    return;
  }

  if(scene.type === "energy"){
    renderEnergyDash(scene.payload?.theme || "forest");
    if(btnNext) btnNext.disabled = !state.energy.done;
    return;
  }

  if(scene.type === "travel"){
    renderTravelChoice(scene.payload?.theme || "forest");
    if(btnNext) btnNext.disabled = !state.travel.done;
    return;
  }

  // unknown
  area.innerHTML = `<div class="emptyState"><div class="bigText">Loading…</div></div>`;
}

function nextScene(){
  const scene = currentScene();
  if(!scene) return;

  // Require mini-game completion
  if(scene.type === "sorter" && !state.sorter.done){ toast("Finish the sorter first ✨"); return; }
  if(scene.type === "energy"  && !state.energy.done){ toast("Finish the energy dash first ✨"); return; }
  if(scene.type === "travel"  && !state.travel.done){ toast("Pick a travel choice first ✨"); return; }

  state.sceneIndex++;

  // If we crossed the end -> wrap to map
  if(state.sceneIndex >= state.questScenes.length){
    setScreen("map");
    return;
  }

  // When entering the final scene for a biome, mark completion if it is a story ending
  // We'll mark completion when we hit the last story in a biome (the last scene) and it is of type story.
  const b = state.currentBiomeId;
  if(state.sceneIndex === state.questScenes.length - 1){
    // allow story render; completion will be applied when the last scene is read and Next pressed
  }

  renderScene();
}

function prevScene(){
  if(state.sceneIndex <= 0) return;
  state.sceneIndex--;
  renderScene();
}

function exitQuestToMap(){
  // stop timers
  stopEnergyTimer();
  setScreen("map");
}

function maybeCompleteBiome(){
  const b = state.currentBiomeId;
  if(!b) return;
  const p = activeStudent();
  if(p.biomeProgress[b]) return;

  // Mark complete and award stars
  p.biomeProgress[b] = true;
  const bonus = 3; // biome completion bonus
  p.stars += bonus;
  p.updatedAt = Date.now();
  save();

  toast(`Biome completed! +${bonus} ⭐`);
  speak("Biome completed.");
  updateHUD();
  renderMap();
}

// ---------- Mini-game: Waste sorter
const SORTER_BANK = {
  forest: [
    { id:"banana",  label:"Banana peel", emoji:"🍌", bin:"compost" },
    { id:"bottle",  label:"Plastic bottle", emoji:"🧴", bin:"recycle" },
    { id:"paper",   label:"Old paper", emoji:"📄", bin:"recycle" },
    { id:"wrapper", label:"Candy wrapper", emoji:"🍬", bin:"trash" },
    { id:"leaves",  label:"Dry leaves", emoji:"🍂", bin:"compost" },
  ],
  ocean: [
    { id:"straw",   label:"Plastic straw", emoji:"🥤", bin:"trash" },
    { id:"can",     label:"Aluminum can", emoji:"🥫", bin:"recycle" },
    { id:"shell",   label:"Shell", emoji:"🐚", bin:"compost" },
    { id:"bag",     label:"Plastic bag", emoji:"🛍️", bin:"trash" },
    { id:"paper",   label:"Paper", emoji:"📄", bin:"recycle" },
  ],
  city: [
    { id:"box",     label:"Cardboard box", emoji:"📦", bin:"recycle" },
    { id:"cup",     label:"Styrofoam cup", emoji:"🥤", bin:"trash" },
    { id:"apple",   label:"Apple core", emoji:"🍎", bin:"compost" },
    { id:"bottle",  label:"Glass bottle", emoji:"🍾", bin:"recycle" },
    { id:"tissue",  label:"Used tissue", emoji:"🧻", bin:"trash" },
  ],
};

const BINS = [
  { id:"recycle", name:"Recycle", icon:"♻️", hint:"Paper, cans, bottles" },
  { id:"compost", name:"Compost", icon:"🌱", hint:"Food & plant scraps" },
  { id:"trash",   name:"Trash",   icon:"🗑️", hint:"Wrappers & mixed" },
];

function renderWasteSorter(theme){
  const area = $("#gameArea");
  if(!area) return;

  const items = shuffle([...(SORTER_BANK[theme] || SORTER_BANK.forest)]).slice(0, 4);
  state.sorter.remaining = items.length;
  state.sorter.selectedItemId = null;
  state.sorter.done = false;

  area.innerHTML = `
    <div class="sorterWrap">
      <div class="itemsPanel">
        <h3>Pick an item, then choose a bin</h3>
        <div id="sorterItems"></div>
        <div class="small">Tip: Click an item to select it, then click a bin.</div>
      </div>
      <div class="bins" id="sorterBins"></div>
    </div>
  `;

  const list = $("#sorterItems");
  const bins = $("#sorterBins");

  items.forEach(it => {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = it.id;
    div.dataset.bin = it.bin;
    div.innerHTML = `
      <div class="left"><span class="emoji">${it.emoji}</span><div><div class="name">${it.label}</div><div class="small">Where does this go?</div></div></div>
      <span class="tag">Select</span>
    `;
    div.addEventListener("click", () => {
      $$("#sorterItems .item").forEach(x => x.classList.remove("selected"));
      div.classList.add("selected");
      state.sorter.selectedItemId = it.id;
      toast(`Selected: ${it.label}`);
    });
    list.appendChild(div);
  });

  BINS.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "bin";
    btn.innerHTML = `
      <div>
        <div class="name">${b.name}</div>
        <div class="hint">${b.hint}</div>
      </div>
      <div class="icon">${b.icon}</div>
    `;
    btn.addEventListener("click", () => {
      const selectedId = state.sorter.selectedItemId;
      if(!selectedId){ toast("Select an item first ✨"); return; }

      const selectedEl = $("#sorterItems .item.selected");
      const correctBin = selectedEl?.dataset.bin;

      if(correctBin === b.id){
        selectedEl.remove();
        state.sorter.remaining--;

        // star reward
        const p = activeStudent();
        p.stars += 1;
        p.updatedAt = Date.now();
        save();
        updateHUD();

        toast("Correct! +1 ⭐");
        speak("Correct.");
      }else{
        toast("Oops! Try again 😄");
        speak("Try again.");
      }

      state.sorter.selectedItemId = null;

      if(state.sorter.remaining <= 0){
        state.sorter.done = true;
        toast("Sorter complete! Press Next ▶");
        speak("Sorter complete.");
        const btnNext = $("#btnQuestNext");
        if(btnNext) btnNext.disabled = false;
      }
    });
    bins.appendChild(btn);
  });

  const btnNext = $("#btnQuestNext");
  if(btnNext) btnNext.disabled = true;
}

// ---------- Mini-game: Energy dash
const ENERGY_PRESETS = {
  forest: [
    { id:"lights",   name:"Cabin Lights",   icon:"💡", on:true,  essential:false },
    { id:"heater",   name:"Space Heater",  icon:"🔥", on:true,  essential:false },
    { id:"radio",    name:"Radio",         icon:"📻", on:false, essential:false },
    { id:"fridge",   name:"Mini Fridge",   icon:"🧊", on:true,  essential:true  },
    { id:"charger",  name:"Charger",       icon:"🔌", on:true,  essential:false },
    { id:"fan",      name:"Fan",           icon:"🌀", on:false, essential:false },
  ],
  ocean: [
    { id:"screens",  name:"Lab Screens",   icon:"🖥️", on:true,  essential:false },
    { id:"ac",       name:"Air Cooler",    icon:"❄️", on:true,  essential:false },
    { id:"pump",     name:"Water Pump",    icon:"🚰", on:true,  essential:true  },
    { id:"lights",   name:"Hall Lights",   icon:"💡", on:true,  essential:false },
    { id:"printer",  name:"Printer",       icon:"🖨️", on:false, essential:false },
    { id:"charger",  name:"Charger",       icon:"🔌", on:true,  essential:false },
  ],
  city: [
    { id:"donut",    name:"Neon Donut Sign",icon:"🍩", on:true,  essential:false },
    { id:"office",   name:"Office Lights",  icon:"💡", on:true,  essential:false },
    { id:"elevator", name:"Elevator",       icon:"🛗", on:false, essential:true  },
    { id:"billboard",name:"Billboard",      icon:"🪧", on:true,  essential:false },
    { id:"server",   name:"Server Rack",    icon:"🗄️", on:true,  essential:true  },
    { id:"ac",       name:"A/C",            icon:"❄️", on:true,  essential:false },
  ],
};

function stopEnergyTimer(){
  if(state.energy.timerId){
    clearInterval(state.energy.timerId);
    state.energy.timerId = null;
  }
}

function renderEnergyDash(theme){
  const area = $("#gameArea");
  if(!area) return;

  stopEnergyTimer();

  const devices = shuffle([...(ENERGY_PRESETS[theme] || ENERGY_PRESETS.forest)]).slice(0, 6)
    .map(d => ({...d}));

  state.energy.devices = devices;
  state.energy.timeLeft = 20;
  state.energy.done = false;

  area.innerHTML = `
    <div class="row between center">
      <div>
        <div class="bigText">Power Down Challenge ⚡</div>
        <div class="small">Turn OFF what’s not needed. Leave essential devices ON.</div>
      </div>
      <div class="pill" id="energyTimer">⏱️ 20s</div>
    </div>
    <div class="energyGrid" id="energyGrid" style="margin-top:12px;"></div>
    <div class="small" style="margin-top:10px;">Goal: All non-essential devices should be OFF.</div>
  `;

  const grid = $("#energyGrid");

  function render(){
    grid.innerHTML = "";
    state.energy.devices.forEach(d => {
      const card = document.createElement("div");
      card.className = "device";
      card.innerHTML = `
        <div class="top">
          <div class="icon">${d.icon}</div>
          <div class="state ${d.on ? "on" : "off"}">${d.on ? "ON" : "OFF"}</div>
        </div>
        <div class="name">${d.name}</div>
        <div class="timerLine">${d.essential ? "Essential ✅" : "Not needed ❌"}</div>
      `;

      card.addEventListener("click", () => {
        // allow toggling
        d.on = !d.on;
        render();
        checkWin();
      });

      grid.appendChild(card);
    });
  }

  function checkWin(){
    if(state.energy.done) return;
    const ok = state.energy.devices.every(d => d.essential ? d.on : !d.on);
    if(ok){
      state.energy.done = true;
      stopEnergyTimer();

      const p = activeStudent();
      p.stars += 3;
      p.updatedAt = Date.now();
      save();
      updateHUD();

      toast("Energy saved! +3 ⭐ Press Next ▶");
      speak("Energy saved.");

      const btnNext = $("#btnQuestNext");
      if(btnNext) btnNext.disabled = false;
    }
  }

  render();

  // timer
  const timerEl = $("#energyTimer");
  state.energy.timerId = setInterval(() => {
    state.energy.timeLeft--;
    if(timerEl) timerEl.textContent = `⏱️ ${state.energy.timeLeft}s`;
    if(state.energy.timeLeft <= 0){
      stopEnergyTimer();
      // time over: still allow next, but fewer stars
      if(!state.energy.done){
        state.energy.done = true;

        const p = activeStudent();
        p.stars += 1;
        p.updatedAt = Date.now();
        save();
        updateHUD();

        toast("Time! Nice try. +1 ⭐ Press Next ▶");
        speak("Time. Nice try.");

        const btnNext = $("#btnQuestNext");
        if(btnNext) btnNext.disabled = false;
      }
    }
  }, 1000);

  const btnNext = $("#btnQuestNext");
  if(btnNext) btnNext.disabled = true;
}

// ---------- Mini-game: Travel choice
const TRAVEL_CHOICES = {
  forest: {
    prompt: "How should we travel to the ranger station?",
    options: [
      { id:"bike",  icon:"🚲", title:"Cycle", desc:"No fuel, clean air", correct:true },
      { id:"car",   icon:"🚗", title:"Car",   desc:"Uses fuel", correct:false },
      { id:"plane", icon:"✈️", title:"Plane", desc:"Big emissions", correct:false },
      { id:"bus",   icon:"🚌", title:"Bus",   desc:"Shared ride", correct:true },
    ]
  },
  ocean: {
    prompt: "How do we deliver a message along the beach?",
    options: [
      { id:"walk",  icon:"🚶‍♀️", title:"Walk", desc:"Zero emissions", correct:true },
      { id:"scoot", icon:"🛴",  title:"Scooter", desc:"Low emissions if shared", correct:true },
      { id:"truck", icon:"🚚",  title:"Truck", desc:"Uses more fuel", correct:false },
      { id:"jet",   icon:"✈️",  title:"Jet",   desc:"Not needed", correct:false },
    ]
  },
  city: {
    prompt: "What’s a greener way to move around the city?",
    options: [
      { id:"metro", icon:"🚇", title:"Metro", desc:"Moves many people", correct:true },
      { id:"bike",  icon:"🚲", title:"Cycle", desc:"Clean and healthy", correct:true },
      { id:"car",   icon:"🚗", title:"Solo Car", desc:"More pollution per person", correct:false },
      { id:"idle",  icon:"⛽", title:"Idle Engine", desc:"Wastes fuel", correct:false },
    ]
  }
};

function renderTravelChoice(theme){
  const area = $("#gameArea");
  if(!area) return;

  state.travel.answered = false;
  state.travel.done = false;

  const cfg = TRAVEL_CHOICES[theme] || TRAVEL_CHOICES.forest;

  area.innerHTML = `
    <div class="bigText">Travel Choice 🚦</div>
    <p class="small" style="margin-top:6px;">${cfg.prompt} (Pick one)</p>
    <div class="choices" id="travelChoices" style="margin-top:12px;"></div>
    <div class="small" id="travelFeedback" style="margin-top:12px;"></div>
  `;

  const wrap = $("#travelChoices");
  const feedback = $("#travelFeedback");

  cfg.options.slice(0,4).forEach(opt => {
    const card = document.createElement("div");
    card.className = "choice";
    card.innerHTML = `
      <div class="icon">${opt.icon}</div>
      <div class="title">${opt.title}</div>
      <div class="desc">${opt.desc}</div>
    `;

    card.addEventListener("click", () => {
      if(state.travel.answered) return;
      state.travel.answered = true;

      if(opt.correct){
        const p = activeStudent();
        p.stars += 2;
        p.updatedAt = Date.now();
        save();
        updateHUD();

        if(feedback) feedback.textContent = "Great choice! Cleaner travel = cleaner air. +2 ⭐";
        toast("Nice! +2 ⭐");
        speak("Great choice.");
      }else{
        const p = activeStudent();
        p.stars += 1;
        p.updatedAt = Date.now();
        save();
        updateHUD();

        if(feedback) feedback.textContent = "Hmm… that uses more fuel. Next time pick a greener option. +1 ⭐";
        toast("Good try! +1 ⭐");
        speak("Good try.");
      }

      state.travel.done = true;
      const btnNext = $("#btnQuestNext");
      if(btnNext) btnNext.disabled = false;

      // If we're at the last scene and it's the last story, completion will happen after Next.
    });

    wrap.appendChild(card);
  });

  const btnNext = $("#btnQuestNext");
  if(btnNext) btnNext.disabled = true;
}

// ---------- Learn screen
function renderFacts(){
  const grid = $("#factGrid");
  if(!grid) return;

  grid.innerHTML = "";
  facts.forEach(f => {
    const card = document.createElement("div");
    card.className = "fact";
    card.innerHTML = `
      <div class="emoji">${f.emoji}</div>
      <div class="title">${f.q}</div>
      <div class="answer">${f.a}</div>
      <div class="small" style="margin-top:10px;">Tap to reveal</div>
    `;
    card.addEventListener("click", () => card.classList.toggle("revealed"));
    grid.appendChild(card);
  });
}

// ---------- Teacher dashboard
function renderTeacher(){
  updateHUD();

  const className = $("#className");
  const missionSelect = $("#missionSelect");
  if(className) className.value = state.className;
  if(missionSelect) missionSelect.value = state.teacherMission;

  const activeLabel = $("#activeStudentLabel");
  const p = activeStudent();
  if(activeLabel) activeLabel.textContent = p.name;

  renderStudentList();
  renderLeaderboard();
}

function renderStudentList(){
  const list = $("#studentList");
  if(!list) return;
  list.innerHTML = "";

  state.students
    .slice()
    .sort((a,b) => (b.stars - a.stars) || (b.updatedAt - a.updatedAt))
    .forEach(s => {
      const row = document.createElement("div");
      row.className = "studentRow";
      const badge = computeBadge(s.stars);
      row.innerHTML = `
        <div>
          <div class="name">${escapeHtml(s.name)}</div>
          <div class="meta">⭐ ${s.stars} • ${escapeHtml(badge)} • Forest:${s.biomeProgress.forest ? "✅":"❌"} Ocean:${s.biomeProgress.ocean ? "✅":"❌"} City:${s.biomeProgress.city ? "✅":"❌"}</div>
        </div>
        <div class="actions">
          <button class="miniBtn" data-act="active">Set Active</button>
          <button class="miniBtn" data-act="plus">+1 ⭐</button>
          <button class="miniBtn" data-act="minus">-1 ⭐</button>
          ${s.id !== "guest" ? `<button class="miniBtn" data-act="delete">Delete</button>` : ``}
        </div>
      `;

      row.querySelectorAll(".miniBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.act;
          if(act === "active"){
            state.activeStudentId = s.id;
            save();
            updateHUD();
            renderHomeAvatar();
            renderMap();
            renderTeacher();
            toast(`Active: ${s.name}`);
          }
          if(act === "plus"){
            s.stars += 1;
            s.updatedAt = Date.now();
            save();
            renderTeacher();
            updateHUD();
          }
          if(act === "minus"){
            s.stars = Math.max(0, s.stars - 1);
            s.updatedAt = Date.now();
            save();
            renderTeacher();
            updateHUD();
          }
          if(act === "delete"){
            state.students = state.students.filter(x => x.id !== s.id);
            if(state.activeStudentId === s.id) state.activeStudentId = "guest";
            save();
            renderTeacher();
            updateHUD();
            toast("Student deleted");
          }
        });
      });

      list.appendChild(row);
    });
}

function renderLeaderboard(){
  const board = $("#leaderboard");
  if(!board) return;

  const sorted = state.students.slice().sort((a,b) => b.stars - a.stars);
  board.innerHTML = "";

  sorted.slice(0, 10).forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "studentRow";
    row.innerHTML = `
      <div>
        <div class="name">#${idx+1} ${escapeHtml(s.name)}</div>
        <div class="meta">⭐ ${s.stars} • ${escapeHtml(computeBadge(s.stars))}</div>
      </div>
      <div class="actions"><span class="pill">${idx === 0 ? "🏆" : "⭐"}</span></div>
    `;
    board.appendChild(row);
  });
}

function addStudent(){
  const input = $("#studentName");
  if(!input) return;
  const name = input.value.trim().slice(0, 26);
  if(!name){ toast("Enter a student name" ); return; }

  const id = "s_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  state.students.push(makeStudent(id, name));
  input.value = "";
  save();
  renderTeacher();
  updateHUD();
  toast("Student added ✅");
}

function saveMission(){
  const missionSelect = $("#missionSelect");
  state.teacherMission = missionSelect?.value || "all";
  save();
  updateHUD();
  renderMap();
  toast("Mission saved 🎯");
}

function resetClass(){
  // keep guest but reset students
  state.students = [ makeStudent("guest","Guest") ];
  state.activeStudentId = "guest";
  state.className = "";
  state.teacherMission = "all";
  save();
  updateHUD();
  renderHomeAvatar();
  renderMap();
  renderTeacher();
  toast("Class reset ✅");
}

function exportCSV(){
  const rows = [];
  rows.push(["className", "studentId", "studentName", "stars", "badge", "forest", "ocean", "city", "updatedAt"].join(","));

  state.students.forEach(s => {
    const badge = computeBadge(s.stars);
    rows.push([
      csvCell(state.className || ""),
      csvCell(s.id),
      csvCell(s.name),
      s.stars,
      csvCell(badge),
      s.biomeProgress.forest ? 1 : 0,
      s.biomeProgress.ocean  ? 1 : 0,
      s.biomeProgress.city   ? 1 : 0,
      new Date(s.updatedAt).toISOString(),
    ].join(","));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eco-quest-class_${(state.className || "class").replace(/\s+/g,"_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("CSV exported ⬇️");
}

function printCertificate(){
  const p = activeStudent();
  const badge = computeBadge(p.stars);

  const certHtml = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Eco Quest Certificate</title>
      <style>
        body{ font-family: system-ui, Segoe UI, Arial; padding: 32px; }
        .card{ border: 6px solid #0d2a55; border-radius: 22px; padding: 26px; max-width: 900px; margin: 0 auto; }
        h1{ margin: 0; font-size: 34px; }
        .sub{ margin-top: 6px; font-weight: 700; color:#0d2a55; }
        .row{ display:flex; gap:24px; align-items:center; margin-top: 18px; }
        .box{ border:4px solid #0d2a55; border-radius: 18px; padding: 10px; }
        .big{ font-size: 26px; font-weight: 900; }
        .meta{ margin-top: 10px; font-weight: 700; }
        .stars{ font-size: 20px; }
        .footer{ margin-top: 22px; font-size: 12px; color:#333; }
        @media print{ button{display:none;} }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🏅 Certificate of Eco Heroism</h1>
        <div class="sub">Eco Quest Adventure</div>
        <div class="row">
          <div class="box">${renderAvatarSVG(p.avatar, p.stars, 160)}</div>
          <div>
            <div class="big">Awarded to: ${escapeHtml(p.name)}</div>
            <div class="meta">Hero name: ${escapeHtml(p.avatar.displayName || "Eco Hero")}</div>
            <div class="meta">Badge: ${escapeHtml(badge)}</div>
            <div class="meta stars">Stars: ⭐ ${p.stars}</div>
          </div>
        </div>
        <div class="footer">Printed on ${new Date().toLocaleString()} • Keep helping Earth 🌍</div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  if(!w){ toast("Pop-up blocked. Allow pop-ups to print."); return; }
  w.document.open();
  w.document.write(certHtml);
  w.document.close();
}

function toggleProjectorMode(){
  state.projectorMode = !state.projectorMode;
  document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";
  save();
  toast(state.projectorMode ? "Projector mode ON 📽️" : "Projector mode OFF");
}

// ---------- Utilities
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(str){ return escapeHtml(str); }

function csvCell(value){
  const s = String(value ?? "");
  if(/[\",\n]/.test(s)) return '"' + s.replaceAll('"','""') + '"';
  return s;
}

function initHomeText(){
  const q = $("#quickWin");
  const h = $("#storyHook");
  if(q) q.textContent = pick(quickWins);
  if(h) h.textContent = pick(storyHooks);
}

// ---------- Init
function init(){
  load();
  document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";

  initHomeText();
  updateHUD();
  renderHomeAvatar();
  renderFacts();
  renderMap();

  // Tabs
  $$(".tab").forEach(btn => btn.addEventListener("click", () => setScreen(btn.dataset.screen)));

  // Home actions
  $("#btnGoMap")?.addEventListener("click", () => setScreen("map"));
  $("#btnStartQuest")?.addEventListener("click", () => setScreen("map"));
  $("#btnHow")?.addEventListener("click", () => {
    const panel = $("#howPanel");
    if(panel) panel.hidden = !panel.hidden;
  });

  // Read aloud
  $("#btnRead")?.addEventListener("click", () => {
    state.readAloud = !state.readAloud;
    save();
    updateHUD();
    toast(`Read Aloud ${state.readAloud ? "On" : "Off"}`);
  });

  // Reset
  $("#btnResetAll")?.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.students = [ makeStudent("guest","Guest") ];
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

  // Avatar modal
  $("#btnOpenAvatar")?.addEventListener("click", openAvatarModal);
  $("#btnCloseAvatar")?.addEventListener("click", closeAvatarModal);
  $("#avatarModal")?.addEventListener("click", (e) => {
    if(e.target && e.target.dataset && e.target.dataset.close === "1") closeAvatarModal();
  });

  const avatarControls = [
    "#heroDisplayName","#skinTone","#bodyShape","#pose","#outline",
    "#eyes","#mouth","#cheeks",
    "#hairStyle","#hairColor",
    "#outfit","#outfitColor",
    "#hat","#accessory","#sidekick",
  ];
  avatarControls.forEach(id => {
    const el = $(id);
    if(!el) return;
    el.addEventListener("input", () => { updateAvatarBuilderUI(); renderAvatarBuilderPreview(); });
    el.addEventListener("change", () => { updateAvatarBuilderUI(); renderAvatarBuilderPreview(); });
  });

  $("#btnSaveAvatar")?.addEventListener("click", saveAvatar);
  $("#btnRandomHero")?.addEventListener("click", randomHero);
  $("#btnPoseWiggle")?.addEventListener("click", () => {
    const preview = $("#avatarPreview");
    if(!preview) return;
    preview.classList.remove("wiggle");
    void preview.offsetWidth;
    preview.classList.add("wiggle");
  });

  // Quest buttons
  $("#btnQuestExit")?.addEventListener("click", exitQuestToMap);
  $("#btnQuestBack")?.addEventListener("click", prevScene);
  $("#btnQuestNext")?.addEventListener("click", () => {
    // If leaving the last story scene, mark completion.
    const scene = currentScene();
    const isLast = state.sceneIndex === state.questScenes.length - 1;
    if(isLast && scene?.type === "story"){
      maybeCompleteBiome();
    }
    nextScene();
  });

  // Map focus
  $("#btnMapFocus")?.addEventListener("click", () => toast("Follow the glowing travel line ✨"));

  // Teacher hooks
  $("#className")?.addEventListener("input", (e) => { state.className = e.target.value; save(); });
  $("#btnAddStudent")?.addEventListener("click", addStudent);
  $("#btnSaveMission")?.addEventListener("click", saveMission);
  $("#btnExportCSV")?.addEventListener("click", exportCSV);
  $("#btnResetClass")?.addEventListener("click", resetClass);
  $("#btnPrintCert")?.addEventListener("click", printCertificate);
  $("#btnProjector")?.addEventListener("click", toggleProjectorMode);

  // Responsive map hotspots
  window.addEventListener("resize", () => {
    if(state.screen === "map") renderMap();
  });

  setScreen("home");
}

init();
