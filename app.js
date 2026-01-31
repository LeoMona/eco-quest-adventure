/* Eco Quest Adventure (Front-end only)
   - Story-based quest flow
   - World map with biomes (Forest -> Ocean -> City)
   - Mini-games inside each biome quest: Waste Sorter, Energy Dash, Travel Choice
   - Teacher dashboard: student roster, active student, leaderboard, CSV export
*/

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STORAGE_KEY = "ecoQuestAdventure_v1";

const state = {
  screen: "home",
  readAloud: false,
  projectorMode: false,

  // class + players
  className: "",
  activeStudentId: "guest",
  students: [
    // {id, name, stars, score, badge, biomeProgress:{forest:bool,ocean:bool,city:bool}, updatedAt}
  ],

  // quest runtime
  currentBiomeId: null,
  sceneIndex: 0,
  questScenes: [],

  // mini-game runtime (reused)
  sorter: { remaining: 0, selectedItemId: null },
  energy: { timeLeft: 20, timerId: null, devices: [] },
  travel: { answered: false }
};

const quickWins = [
  "Turn off the tap while brushing teeth 💧",
  "Use a reusable bottle 🥤",
  "Switch off lights when leaving a room 💡",
  "Walk or cycle for short trips 🚶‍♀️🚲",
  "Reuse paper for drawing 📝"
];

const storyHooks = [
  "Captain Carbon is causing trouble… can you stop the waste storm?",
  "Plastic is drifting into the sea… EcoBot needs your help!",
  "The city is wasting energy… time to power down smartly!"
];

const badges = [
  { name:"Seedling Saver", stars: 5, icon:"🌱" },
  { name:"Super Recycler", stars: 12, icon:"♻️" },
  { name:"Energy Guardian", stars: 20, icon:"💡" },
  { name:"Planet Pal", stars: 30, icon:"🌍" }
];

/* ---------------------------
   BIOMES + QUEST SCENES
----------------------------*/
const BIOMES = [
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    desc: "Help animals and keep the forest clean.",
    unlocks: null,
    scenes: (playerName) => ([
      story("🤖","EcoBot",`Welcome ${playerName}! The forest animals are worried. Captain Carbon dropped trash near the trees!`,"Sorting and recycling protect nature."),
      game("sorter", { theme: "forest" }),
      story("🦉","Ollie the Owl","Hoot hoot! Great sorting. Now let's choose a clean way to visit the ranger station!","Travel choices can reduce pollution."),
      game("travel", { theme: "forest" }),
      story("🦌","Dara the Deer","Yay! The forest feels fresher. One more thing—turn off things you’re not using at the cabin!","Saving energy helps the planet."),
      game("energy", { theme: "forest" }),
      story("🌟","Narrator","Biome Complete! The Forest is smiling again. You unlocked the Ocean biome!","Great job, Eco Hero!")
    ])
  },
  {
    id: "ocean",
    name: "Ocean",
    icon: "🌊",
    desc: "Stop plastic and protect sea creatures.",
    unlocks: "forest",
    scenes: (playerName) => ([
      story("🤖","EcoBot",`Oh no, ${playerName}! Plastic is floating into the ocean. Let’s sort and reduce waste!`,"Less plastic means safer oceans."),
      game("sorter", { theme: "ocean" }),
      story("🐢","Tara the Turtle","Thank you! Now choose the greener way to deliver a message along the beach!","Walking, cycling, and buses can be cleaner."),
      game("travel", { theme: "ocean" }),
      story("🦀","Crab Coach","Last mission: save energy at the sea lab—switch off unused devices!","Energy saving reduces pollution."),
      game("energy", { theme: "ocean" }),
      story("🌟","Narrator","Biome Complete! The Ocean is sparkling. You unlocked the City biome!","You’re becoming a climate champion!")
    ])
  },
  {
    id: "city",
    name: "City",
    icon: "🏙️",
    desc: "Clean air mission: energy + transport choices.",
    unlocks: "ocean",
    scenes: (playerName) => ([
      story("🤖","EcoBot",`Welcome to the City, ${playerName}! Captain Carbon turned everything ON… wasting energy!`,"Energy saving helps air quality."),
      game("energy", { theme: "city" }),
      story("🚦","Mayor Green","Amazing! Now choose the cleanest travel for school and errands.","Transport choices can lower pollution."),
      game("travel", { theme: "city" }),
      story("♻️","Recycling Crew","Final mission: sort city trash correctly so it can be recycled!","Sorting makes recycling possible."),
      game("sorter", { theme: "city" }),
      story("🏆","Narrator","You finished ALL biomes! Earth thanks you, Eco Hero!","You unlocked the Planet Pal badge goal!")
    ])
  }
];

function story(avatar, who, text, why){
  return { type: "story", avatar, who, text, why };
}
function game(kind, payload){
  return { type: kind, payload };
}

/* ---------------------------
   FACTS
----------------------------*/
const facts = [
  { emoji:"🌞", q:"Why is Earth getting warmer?", a:"Some gases act like a warm blanket around Earth. Too many makes it hotter." },
  { emoji:"♻️", q:"What does recycle mean?", a:"Turn old things into new things so we make less trash." },
  { emoji:"💡", q:"Why save electricity?", a:"Making electricity can cause pollution. Using less helps the air stay cleaner." },
  { emoji:"🚲", q:"What travel is greener?", a:"Walking, cycling, and buses usually create less pollution than single-car rides." },
  { emoji:"🌳", q:"Why are trees important?", a:"Trees help clean the air and give homes to animals." },
  { emoji:"💧", q:"Why save water?", a:"Clean water is precious. Saving it helps people, animals, and nature." }
];

/* ---------------------------
   Storage Helpers
----------------------------*/
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) {
      ensureGuest();
      return;
    }
    const saved = JSON.parse(raw);
    state.readAloud = saved.readAloud ?? false;
    state.className = saved.className ?? "";
    state.activeStudentId = saved.activeStudentId ?? "guest";
    state.students = saved.students ?? [];
    state.projectorMode = saved.projectorMode ?? false;
    ensureGuest();
  }catch(e){
    ensureGuest();
  }
}

function save(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    readAloud: state.readAloud,
    className: state.className,
    activeStudentId: state.activeStudentId,
    students: state.students,
    projectorMode: state.projectorMode
  }));
}

function ensureGuest(){
  if(!state.students.find(s => s.id === "guest")){
    state.students.push(makeStudent("guest","Guest"));
  }
  if(!state.activeStudentId) state.activeStudentId = "guest";
}

function makeStudent(id,name){
  return {
    id, name,
    stars: 0,
    score: 0,
    badge: "—",
    biomeProgress: { forest:false, ocean:false, city:false },
    updatedAt: Date.now()
  };
}

function resetAll(){
  localStorage.removeItem(STORAGE_KEY);
  state.readAloud = false;
  state.projectorMode = false;
  state.className = "";
  state.activeStudentId = "guest";
  state.students = [ makeStudent("guest","Guest") ];
  save();
  toast("Reset complete ✅");
  renderAll();
}

/* ---------------------------
   UI + Speech
----------------------------*/
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 1800);
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

function setScreen(screen){
  state.screen = screen;
  $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.screen === screen));
  ["home","map","quest","learn","teacher"].forEach(s => {
    $(`#screen-${s}`).classList.toggle("active", s === screen);
  });

  if(screen === "map") renderMap();
  if(screen === "learn") renderFacts();
  if(screen === "teacher") renderTeacher();
}

function activeStudent(){
  return state.students.find(s => s.id === state.activeStudentId) || state.students[0];
}

function updateHUD(){
  const p = activeStudent();
  $("#hudPlayer").textContent = p.name;
  $("#hudStars").textContent = `⭐ ${p.stars}`;
  $("#hudBadge").textContent = computeBadge(p.stars);
  $("#btnRead").textContent = `🔊 Read Aloud: ${state.readAloud ? "On" : "Off"}`;
  $("#btnRead").setAttribute("aria-pressed", String(state.readAloud));
}

function computeBadge(stars){
  const unlocked = badges.filter(b => stars >= b.stars);
  return unlocked.length ? unlocked[unlocked.length-1].name : "—";
}

function renderAll(){
  updateHUD();
  renderMap();
  renderFacts(); // harmless to pre-render
  renderTeacher();
}

/* ---------------------------
   MAP + Biome Locking
----------------------------*/
function biomeUnlocked(biomeId){
  const b = BIOMES.find(x => x.id === biomeId);
  if(!b) return false;
  if(!b.unlocks) return true; // forest
  const p = activeStudent();
  return Boolean(p.biomeProgress[b.unlocks]);
}

function biomeComplete(biomeId){
  const p = activeStudent();
  return Boolean(p.biomeProgress[biomeId]);
}

function renderMap(){
  const grid = $("#mapGrid");
  if(!grid) return;
  grid.innerHTML = "";

  BIOMES.forEach(b => {
    const locked = !biomeUnlocked(b.id);
    const complete = biomeComplete(b.id);

    const card = document.createElement("div");
    card.className = `biomeCard ${locked ? "locked":""}`;
    card.tabIndex = locked ? -1 : 0;
    card.setAttribute("role","button");
    card.setAttribute("aria-label", `${b.name} biome`);
    card.innerHTML = `
      <div class="biomeTop">
        <div>
          <div class="biomeName">${b.name}</div>
          <div class="biomeDesc">${b.desc}</div>
        </div>
        <div class="biomeIcon">${b.icon}</div>
      </div>
      <div class="biomeMeta">
        <span class="badgePill">${complete ? "✅ Completed" : "🎒 Quest Ready"}</span>
        <span class="badgePill">${locked ? "🔒 Locked" : "🔓 Unlocked"}</span>
      </div>
    `;

    const open = () => {
      if(locked){
        toast("Finish the previous biome to unlock this one 🔒");
        speak("Finish the previous biome to unlock this one.");
        return;
      }
      startBiomeQuest(b.id);
    };

    card.addEventListener("click", open);
    card.addEventListener("keydown",(e)=>{
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); }
    });

    grid.appendChild(card);
  });
}

/* ---------------------------
   QUEST FLOW (story + games)
----------------------------*/
function startBiomeQuest(biomeId){
  state.currentBiomeId = biomeId;
  state.sceneIndex = 0;

  const biome = BIOMES.find(b => b.id === biomeId);
  const playerName = activeStudent().name;
  state.questScenes = biome.scenes(playerName);

  setScreen("quest");
  renderScene();
  toast(`Quest started: ${biome.name}!`);
}

function renderScene(){
  clearEnergyTimer();

  const biome = BIOMES.find(b => b.id === state.currentBiomeId);
  const scene = state.questScenes[state.sceneIndex];

  $("#questTitle").textContent = `${biome.icon} ${biome.name} Quest`;
  $("#questStep").textContent = `Scene ${state.sceneIndex + 1} / ${state.questScenes.length}`;
  $("#whyItMatters").textContent = scene.why || "Your choices help Earth!";

  // dialogue always updates
  $("#dlgAvatar").textContent = scene.avatar || "🤖";
  $("#dlgWho").textContent = scene.who || "EcoBot";
  $("#dlgText").textContent = scene.text || "Let’s go!";
  speak(`${scene.who || "EcoBot"} says: ${scene.text || ""}`);

  const area = $("#gameArea");
  area.innerHTML = "";

  // buttons
  $("#btnQuestBack").disabled = state.sceneIndex === 0;
  $("#btnQuestNext").disabled = false;

  if(scene.type === "story"){
    area.innerHTML = `
      <div class="emptyState">
        <div class="bigText">Story Time ✨</div>
        <p class="small">Press Next ▶ to continue.</p>
      </div>
    `;
    return;
  }

  if(scene.type === "sorter") renderWasteSorter(scene.payload.theme);
  if(scene.type === "energy") renderEnergyDash(scene.payload.theme);
  if(scene.type === "travel") renderTravelChoice(scene.payload.theme);
}

function nextScene(){
  // If current scene is a game, require completion gate where needed.
  const current = state.questScenes[state.sceneIndex];
  if(current.type !== "story"){
    // completion checks are handled inside games by enabling Next
    // If Next is enabled, proceed.
  }

  if(state.sceneIndex < state.questScenes.length - 1){
    state.sceneIndex++;
    renderScene();

    // If we just moved into final story, mark biome complete if all games were passed
    // We'll mark completion when reaching final scene (which is story) AND all prior games were visited
    // (This is simple and kid-friendly.)
    if(state.sceneIndex === state.questScenes.length - 1){
      completeBiome(state.currentBiomeId);
    }
  } else {
    // Quest ends
    toast("Quest complete! Return to map 🗺️");
    speak("Quest complete. Return to map.");
    setScreen("map");
  }
}

function prevScene(){
  if(state.sceneIndex > 0){
    state.sceneIndex--;
    renderScene();
  }
}

function completeBiome(biomeId){
  const p = activeStudent();
  if(p.biomeProgress[biomeId]) return; // already complete
  p.biomeProgress[biomeId] = true;

  // reward
  p.stars += 4;
  p.score += 15;
  p.badge = computeBadge(p.stars);
  p.updatedAt = Date.now();

  save();
  updateHUD();
  toast(`Biome complete! +⭐ 4`);
}

/* ---------------------------
   MINI GAME DATA (theme-based)
----------------------------*/
const wasteItemsByTheme = {
  forest: [
    { id:"banana", name:"Banana Peel", emoji:"🍌", bin:"compost", tag:"Compost", tagClass:"green" },
    { id:"apple", name:"Apple Core", emoji:"🍎", bin:"compost", tag:"Compost", tagClass:"green" },
    { id:"paper", name:"Paper", emoji:"📄", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"bottle", name:"Bottle", emoji:"🧴", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"can", name:"Can", emoji:"🥫", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"wrapper", name:"Candy Wrapper", emoji:"🍬", bin:"trash", tag:"Trash", tagClass:"yellow" },
    { id:"bag", name:"Plastic Bag", emoji:"🛍️", bin:"trash", tag:"Trash", tagClass:"yellow" }
  ],
  ocean: [
    { id:"bottle", name:"Plastic Bottle", emoji:"🧴", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"net", name:"Old Net (trash)", emoji:"🕸️", bin:"trash", tag:"Trash", tagClass:"yellow" },
    { id:"can", name:"Aluminium Can", emoji:"🥫", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"paper", name:"Paper Note", emoji:"🧾", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"banana", name:"Fruit Peel", emoji:"🍌", bin:"compost", tag:"Compost", tagClass:"green" },
    { id:"straw", name:"Plastic Straw", emoji:"🥤", bin:"trash", tag:"Trash", tagClass:"yellow" }
  ],
  city: [
    { id:"paper", name:"Newspaper", emoji:"🗞️", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"box", name:"Cardboard Box", emoji:"📦", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"bottle", name:"Plastic Bottle", emoji:"🧴", bin:"recycle", tag:"Recycle", tagClass:"" },
    { id:"banana", name:"Food Scrap", emoji:"🍌", bin:"compost", tag:"Compost", tagClass:"green" },
    { id:"cup", name:"Coffee Cup (trash)", emoji:"☕", bin:"trash", tag:"Trash", tagClass:"yellow" },
    { id:"wrapper", name:"Snack Wrapper", emoji:"🍫", bin:"trash", tag:"Trash", tagClass:"yellow" }
  ]
};

const deviceTemplatesByTheme = {
  forest: [
    { id:"lights", name:"Cabin Lights", icon:"💡", startOn:true, neededOff:true },
    { id:"fan", name:"Fan", icon:"🌀", startOn:true, neededOff:true },
    { id:"heater", name:"Heater", icon:"🔥", startOn:true, neededOff:true },
    { id:"radio", name:"Radio", icon:"📻", startOn:true, neededOff:true },
    { id:"laptop", name:"Laptop (in use)", icon:"💻", startOn:false, neededOff:false },
    { id:"charger", name:"Charger", icon:"🔌", startOn:true, neededOff:true }
  ],
  ocean: [
    { id:"lights", name:"Lab Lights", icon:"💡", startOn:true, neededOff:true },
    { id:"ac", name:"AC", icon:"❄️", startOn:true, neededOff:true },
    { id:"printer", name:"Printer", icon:"🖨️", startOn:true, neededOff:true },
    { id:"screen", name:"Big Screen", icon:"🖥️", startOn:true, neededOff:true },
    { id:"microscope", name:"Microscope (in use)", icon:"🔬", startOn:false, neededOff:false },
    { id:"charger", name:"Charger", icon:"🔌", startOn:true, neededOff:true }
  ],
  city: [
    { id:"lights", name:"Office Lights", icon:"💡", startOn:true, neededOff:true },
    { id:"tv", name:"TV", icon:"📺", startOn:true, neededOff:true },
    { id:"console", name:"Game Console", icon:"🎮", startOn:true, neededOff:true },
    { id:"sign", name:"Neon Sign", icon:"✨", startOn:true, neededOff:true },
    { id:"laptop", name:"Laptop (in use)", icon:"💻", startOn:false, neededOff:false },
    { id:"charger", name:"Phone Charger", icon:"🔌", startOn:true, neededOff:true }
  ]
};

const travelScenariosByTheme = {
  forest: [
    {
      q: "You’re going to the ranger station nearby. What’s best?",
      options: [
        { icon:"🚶‍♀️", title:"Walk", desc:"Quiet and clean!", good:true },
        { icon:"🚲", title:"Cycle", desc:"Fast and clean!", good:true },
        { icon:"🚗", title:"Car alone", desc:"More pollution", good:false },
        { icon:"🏍️", title:"Motorbike", desc:"Uses fuel", good:false }
      ]
    }
  ],
  ocean: [
    {
      q: "You need to deliver a note along the beach. What’s best?",
      options: [
        { icon:"🚶‍♂️", title:"Walk", desc:"No pollution!", good:true },
        { icon:"🚲", title:"Cycle", desc:"Clean travel", good:true },
        { icon:"🚤", title:"Speed boat", desc:"Uses fuel", good:false },
        { icon:"🚗", title:"Car alone", desc:"More pollution", good:false }
      ]
    }
  ],
  city: [
    {
      q: "Going to school in the city—what’s greener?",
      options: [
        { icon:"🚌", title:"Bus", desc:"Many people together", good:true },
        { icon:"🚇", title:"Metro/Train", desc:"Often cleaner per person", good:true },
        { icon:"🚗", title:"Car alone", desc:"More traffic & pollution", good:false },
        { icon:"🚕", title:"Taxi alone", desc:"Extra fuel use", good:false }
      ]
    }
  ]
};

/* ---------------------------
   MINI GAME 1: Waste Sorter (with theme)
----------------------------*/
function renderWasteSorter(theme){
  const itemsPool = wasteItemsByTheme[theme] || wasteItemsByTheme.forest;
  const items = shuffle([...itemsPool]).slice(0,5);

  state.sorter.selectedItemId = null;
  state.sorter.remaining = items.length;

  const area = $("#gameArea");
  area.innerHTML = `
    <div class="sorterWrap">
      <div class="itemsPanel">
        <h3>Waste Sorter ♻️ (drag OR tap item then tap bin)</h3>
        <div id="itemsList"></div>
        <p class="small">Remaining: <b id="remainingCount">${state.sorter.remaining}</b></p>
      </div>

      <div class="bins" aria-label="Bins">
        <div class="bin" data-bin="recycle" role="button" tabindex="0" aria-label="Recycle bin">
          <div>
            <div class="name">Recycle</div>
            <div class="hint">Paper, plastic, metal</div>
          </div>
          <div class="icon">♻️</div>
        </div>

        <div class="bin" data-bin="compost" role="button" tabindex="0" aria-label="Compost bin">
          <div>
            <div class="name">Compost</div>
            <div class="hint">Food scraps</div>
          </div>
          <div class="icon">🌿</div>
        </div>

        <div class="bin" data-bin="trash" role="button" tabindex="0" aria-label="Trash bin">
          <div>
            <div class="name">Trash</div>
            <div class="hint">Not recyclable</div>
          </div>
          <div class="icon">🗑️</div>
        </div>
      </div>
    </div>
  `;

  const list = $("#itemsList");

  items.forEach(it=>{
    const div = document.createElement("div");
    div.className = "item";
    div.draggable = true;
    div.dataset.id = it.id;
    div.dataset.bin = it.bin;
    div.tabIndex = 0;
    div.setAttribute("role","button");
    div.setAttribute("aria-label", `${it.name}. Tap to select.`);
    div.innerHTML = `
      <div class="left">
        <div class="emoji">${it.emoji}</div>
        <div>
          <div><b>${it.name}</b></div>
          <div class="small">Where does it go?</div>
        </div>
      </div>
      <span class="tag ${it.tagClass}">${it.tag}</span>
    `;

    div.addEventListener("dragstart", (e)=>{
      e.dataTransfer.setData("text/plain", it.id);
      setSelectedItem(it.id);
    });

    div.addEventListener("click", ()=> setSelectedItem(it.id));
    div.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        setSelectedItem(it.id);
      }
    });

    list.appendChild(div);
  });

  $$(".bin").forEach(bin=>{
    bin.addEventListener("dragover", (e)=>{ e.preventDefault(); bin.classList.add("drop"); });
    bin.addEventListener("dragleave", ()=> bin.classList.remove("drop"));
    bin.addEventListener("drop", (e)=>{
      e.preventDefault();
      bin.classList.remove("drop");
      const itemId = e.dataTransfer.getData("text/plain");
      handleDrop(itemId, bin.dataset.bin);
    });

    bin.addEventListener("click", ()=>{
      if(!state.sorter.selectedItemId) { toast("Select an item first 👆"); speak("Select an item first."); return; }
      handleDrop(state.sorter.selectedItemId, bin.dataset.bin);
    });
    bin.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        if(!state.sorter.selectedItemId) { toast("Select an item first 👆"); return; }
        handleDrop(state.sorter.selectedItemId, bin.dataset.bin);
      }
    });
  });

  // Gate Next until finished
  $("#btnQuestNext").disabled = true;
  $("#btnQuestNext").style.opacity = ".55";
}

function setSelectedItem(itemId){
  state.sorter.selectedItemId = itemId;
  $$(".item").forEach(el => el.classList.toggle("selected", el.dataset.id === itemId));
}

function handleDrop(itemId, targetBin){
  const el = $(`.item[data-id="${itemId}"]`);
  if(!el) return;

  const correctBin = el.dataset.bin;
  const p = activeStudent();

  if(targetBin === correctBin){
    el.remove();
    state.sorter.remaining--;
    $("#remainingCount").textContent = state.sorter.remaining;

    p.score += 3;
    p.stars += 1;
    p.badge = computeBadge(p.stars);
    p.updatedAt = Date.now();

    save();
    updateHUD();
    toast("Correct! ⭐");
    speak("Correct!");

    state.sorter.selectedItemId = null;

    if(state.sorter.remaining === 0){
      $("#btnQuestNext").disabled = false;
      $("#btnQuestNext").style.opacity = "1";
      toast("Sorter complete! Press Next ▶");
      speak("Sorter complete. Press next.");
    }
  } else {
    p.score = Math.max(0, p.score - 1);
    p.updatedAt = Date.now();
    save();
    updateHUD();
    toast("Oops! Try another bin 🙂");
    speak("Oops. Try another bin.");
  }
}

/* ---------------------------
   MINI GAME 2: Energy Dash (with theme)
----------------------------*/
function renderEnergyDash(theme){
  state.energy.timeLeft = 20;
  const devicesPool = deviceTemplatesByTheme[theme] || deviceTemplatesByTheme.forest;

  const devices = shuffle([...devicesPool]).slice(0,6).map(d => ({ ...d, isOn: d.startOn }));
  state.energy.devices = devices;

  const area = $("#gameArea");
  const goal = devices.filter(d=>d.neededOff).length;

  area.innerHTML = `
    <div class="row between center">
      <div class="pill">Goal: Turn OFF <b id="goalCount">${goal}</b> devices</div>
      <div class="pill">⏱️ Time: <span id="timeLeft">${state.energy.timeLeft}</span>s</div>
    </div>
    <p class="timerLine small">Tap devices to toggle ON/OFF.</p>
    <div class="energyGrid" id="energyGrid"></div>
  `;

  const grid = $("#energyGrid");
  devices.forEach(d=>{
    const card = document.createElement("div");
    card.className = "device";
    card.tabIndex = 0;
    card.setAttribute("role","button");
    card.dataset.id = d.id;
    card.innerHTML = `
      <div class="top">
        <div class="icon">${d.icon}</div>
        <div class="name">${d.name}</div>
      </div>
      <div class="state ${d.isOn ? "on":"off"}">${d.isOn ? "ON":"OFF"}</div>
      <div class="small">${d.neededOff ? "Not in use ❗" : "In use ✅"}</div>
    `;
    const toggle = ()=> toggleDevice(d.id);
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e)=>{
      if(e.key==="Enter" || e.key===" "){ e.preventDefault(); toggle(); }
    });
    grid.appendChild(card);
  });

  // Gate Next until success OR timer ends
  $("#btnQuestNext").disabled = true;
  $("#btnQuestNext").style.opacity = ".55";

  clearEnergyTimer();
  state.energy.timerId = setInterval(()=>{
    state.energy.timeLeft--;
    $("#timeLeft").textContent = state.energy.timeLeft;

    if(checkEnergyGoal()){
      clearEnergyTimer();
      rewardEnergy(true);
      enableQuestNext();
    }

    if(state.energy.timeLeft <= 0){
      clearEnergyTimer();
      rewardEnergy(false);
      enableQuestNext();
    }
  }, 1000);
}

function enableQuestNext(){
  $("#btnQuestNext").disabled = false;
  $("#btnQuestNext").style.opacity = "1";
}

function toggleDevice(id){
  const d = state.energy.devices.find(x=>x.id===id);
  if(!d) return;

  d.isOn = !d.isOn;

  const el = $(`.device[data-id="${id}"] .state`);
  if(el){
    el.className = `state ${d.isOn ? "on":"off"}`;
    el.textContent = d.isOn ? "ON" : "OFF";
  }
  toast(d.isOn ? "Switched ON" : "Switched OFF");
}

function checkEnergyGoal(){
  return state.energy.devices.every(d => !d.neededOff || (d.neededOff && !d.isOn));
}

function rewardEnergy(success){
  const p = activeStudent();
  if(success){
    toast("Energy saved! ⭐⭐");
    speak("Energy saved.");
    p.score += 12;
    p.stars += 2;
  } else {
    toast("Time’s up — good try! ⭐");
    speak("Time is up. Good try.");
    p.score += 4;
    p.stars += 1;
  }
  p.badge = computeBadge(p.stars);
  p.updatedAt = Date.now();
  save();
  updateHUD();
}

function clearEnergyTimer(){
  if(state.energy.timerId){
    clearInterval(state.energy.timerId);
    state.energy.timerId = null;
  }
}

/* ---------------------------
   MINI GAME 3: Travel Choice (with theme)
----------------------------*/
function renderTravelChoice(theme){
  state.travel.answered = false;

  const scenarios = travelScenariosByTheme[theme] || travelScenariosByTheme.forest;
  const scene = pick(scenarios);
  const totalGood = scene.options.filter(o=>o.good).length;

  const area = $("#gameArea");
  area.innerHTML = `
    <div class="card inner">
      <div class="bigText">${scene.q}</div>
      <p class="small">Find the green choices 🌿 (you may pick more than one).</p>
    </div>
    <div class="choices" id="choiceGrid"></div>
    <p class="small" id="travelHint">Green choices found: 0 / ${totalGood}</p>
  `;

  let correctFound = 0;
  const grid = $("#choiceGrid");
  const p = activeStudent();

  scene.options.forEach((o)=>{
    const c = document.createElement("div");
    c.className = "choice";
    c.tabIndex = 0;
    c.setAttribute("role","button");
    c.innerHTML = `
      <div class="icon">${o.icon}</div>
      <div class="title">${o.title}</div>
      <div class="desc">${o.desc}</div>
    `;

    const choose = ()=>{
      if(c.dataset.picked === "1") return;
      c.dataset.picked = "1";

      if(o.good){
        correctFound++;
        c.style.background = "rgba(52,211,153,.15)";
        c.style.borderColor = "rgba(52,211,153,.35)";
        toast("Green choice! ⭐");
        speak("Green choice!");
        p.score += 4;
        p.stars += 1;
      } else {
        c.style.background = "rgba(251,113,133,.14)";
        c.style.borderColor = "rgba(251,113,133,.28)";
        toast("Not the greenest 🙂");
        speak("Not the greenest.");
        p.score = Math.max(0, p.score - 1);
      }

      p.badge = computeBadge(p.stars);
      p.updatedAt = Date.now();
      save();
      updateHUD();

      $("#travelHint").textContent = `Green choices found: ${correctFound} / ${totalGood}`;

      if(correctFound >= totalGood){
        state.travel.answered = true;
        toast("All green choices found! Press Next ▶");
        speak("All green choices found. Press next.");
        $("#btnQuestNext").disabled = false;
        $("#btnQuestNext").style.opacity = "1";
      }
    };

    c.addEventListener("click", choose);
    c.addEventListener("keydown", (e)=>{
      if(e.key==="Enter" || e.key===" "){ e.preventDefault(); choose(); }
    });

    grid.appendChild(c);
  });

  // gate next until green choices found
  $("#btnQuestNext").disabled = true;
  $("#btnQuestNext").style.opacity = ".55";
}

/* ---------------------------
   Facts
----------------------------*/
function renderFacts(){
  const grid = $("#factGrid");
  if(!grid) return;
  grid.innerHTML = "";

  facts.forEach((f)=>{
    const card = document.createElement("div");
    card.className = "fact";
    card.tabIndex = 0;
    card.setAttribute("role","button");
    card.setAttribute("aria-label", `${f.q}. Tap to reveal answer`);
    card.innerHTML = `
      <div class="emoji">${f.emoji}</div>
      <div class="title">${f.q}</div>
      <div class="answer">${f.a}</div>
    `;
    const reveal = ()=>{
      card.classList.toggle("revealed");
      if(card.classList.contains("revealed")) speak(`${f.q} ${f.a}`);
    };
    card.addEventListener("click", reveal);
    card.addEventListener("keydown", (e)=>{
      if(e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); }
    });
    grid.appendChild(card);
  });
}

/* ---------------------------
   Teacher Dashboard
----------------------------*/
function renderTeacher(){
  $("#className").value = state.className || "";
  $("#activeStudentLabel").textContent = activeStudent().name;

  renderStudentList();
  renderLeaderboard();
}

function renderStudentList(){
  const box = $("#studentList");
  box.innerHTML = "";

  // show all except guest first, then guest last
  const list = [...state.students].sort((a,b)=>{
    if(a.id==="guest") return 1;
    if(b.id==="guest") return -1;
    return a.name.localeCompare(b.name);
  });

  list.forEach(s=>{
    const row = document.createElement("div");
    row.className = "studentRow";
    row.innerHTML = `
      <div>
        <div class="name">${s.name}</div>
        <div class="meta">⭐ ${s.stars} • Biomes: ${countBiomes(s)} • ${timeAgo(s.updatedAt)}</div>
      </div>
      <div class="actions">
        <button class="miniBtn" data-act="select" data-id="${s.id}">Use</button>
        <button class="miniBtn" data-act="reset" data-id="${s.id}">Reset</button>
        ${s.id === "guest" ? "" : `<button class="miniBtn" data-act="delete" data-id="${s.id}">Delete</button>`}
      </div>
    `;
    box.appendChild(row);
  });

  box.addEventListener("click",(e)=>{
    const btn = e.target.closest("button");
    if(!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if(act==="select") setActiveStudent(id);
    if(act==="reset") resetStudent(id);
    if(act==="delete") deleteStudent(id);
  }, { once:true }); // rebind each render
}

function renderLeaderboard(){
  const box = $("#leaderboard");
  box.innerHTML = "";

  const sorted = [...state.students]
    .filter(s => s.id !== "guest")
    .sort((a,b)=> b.stars - a.stars || b.score - a.score);

  if(sorted.length === 0){
    box.innerHTML = `<div class="small">No students yet. Add students to see leaderboard.</div>`;
    return;
  }

  sorted.slice(0,10).forEach((s, i)=>{
    const row = document.createElement("div");
    row.className = "studentRow";
    row.innerHTML = `
      <div>
        <div class="name">${i===0?"🥇":i===1?"🥈":i===2?"🥉":"🏅"} ${s.name}</div>
        <div class="meta">⭐ ${s.stars} • Score ${s.score} • Badge: ${computeBadge(s.stars)}</div>
      </div>
      <div class="meta">${countBiomes(s)} biomes</div>
    `;
    box.appendChild(row);
  });
}

function countBiomes(s){
  const p = s.biomeProgress || {};
  return ["forest","ocean","city"].filter(k => p[k]).length;
}

function setActiveStudent(id){
  state.activeStudentId = id;
  save();
  updateHUD();
  renderTeacher();
  toast(`Active student: ${activeStudent().name}`);
}

function resetStudent(id){
  const s = state.students.find(x=>x.id===id);
  if(!s) return;
  s.stars = 0;
  s.score = 0;
  s.badge = "—";
  s.biomeProgress = { forest:false, ocean:false, city:false };
  s.updatedAt = Date.now();
  save();
  updateHUD();
  renderTeacher();
  toast(`Reset: ${s.name}`);
}

function deleteStudent(id){
  if(id==="guest") return;
  state.students = state.students.filter(s => s.id !== id);
  if(state.activeStudentId === id) state.activeStudentId = "guest";
  save();
  updateHUD();
  renderTeacher();
  toast("Student deleted");
}

function addStudent(name){
  const clean = (name || "").trim();
  if(!clean){ toast("Enter a student name"); return; }
  const id = "s_" + Math.random().toString(16).slice(2);
  state.students.push(makeStudent(id, clean));
  save();
  renderTeacher();
  toast(`Added: ${clean}`);
}

function exportCSV(){
  const rows = [
    ["Class", state.className || ""],
    [],
    ["Student","Stars","Score","Badge","Forest","Ocean","City","Last Updated"]
  ];

  state.students
    .filter(s => s.id !== "guest")
    .forEach(s=>{
      rows.push([
        s.name,
        s.stars,
        s.score,
        computeBadge(s.stars),
        s.biomeProgress.forest ? "YES":"NO",
        s.biomeProgress.ocean ? "YES":"NO",
        s.biomeProgress.city ? "YES":"NO",
        new Date(s.updatedAt).toISOString()
      ]);
    });

  const csv = rows.map(r => r.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ecoquest_class_${(state.className||"class").replaceAll(" ","_")}.csv`;
  a.click();
  toast("CSV exported ⬇");
}

function resetClass(){
  // Keep guest but clear others
  state.students = [ makeStudent("guest","Guest") ];
  state.activeStudentId = "guest";
  state.className = "";
  save();
  renderAll();
  toast("Class data reset ✅");
}

function toggleProjector(){
  state.projectorMode = !state.projectorMode;
  save();
  document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";
  toast(state.projectorMode ? "Projector Mode ON 📽️" : "Projector Mode OFF");
}

/* ---------------------------
   Helpers
----------------------------*/
function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}
function timeAgo(ts){
  if(!ts) return "never";
  const sec = Math.max(1, Math.floor((Date.now()-ts)/1000));
  if(sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec/60);
  if(min < 60) return `${min}m ago`;
  const hr = Math.floor(min/60);
  if(hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr/24);
  return `${d}d ago`;
}

/* ---------------------------
   Wire up UI
----------------------------*/
function init(){
  load();

  // Home content
  $("#quickWin").textContent = pick(quickWins);
  $("#storyHook").textContent = pick(storyHooks);

  // Tabs
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setScreen(btn.dataset.screen));
  });

  // Home buttons
  $("#btnGoMap").addEventListener("click", ()=> setScreen("map"));
  $("#btnHow").addEventListener("click", ()=>{
    const panel = $("#howPanel");
    panel.hidden = !panel.hidden;
    if(!panel.hidden) speak("How to play. Choose a biome on the world map. Read the story. Play mini missions. Earn stars.");
  });

  // Quest controls
  $("#btnQuestExit").addEventListener("click", ()=>{
    clearEnergyTimer();
    setScreen("map");
  });
  $("#btnQuestNext").addEventListener("click", nextScene);
  $("#btnQuestBack").addEventListener("click", prevScene);

  // Top buttons
  $("#btnRead").addEventListener("click", ()=>{
    state.readAloud = !state.readAloud;
    save();
    updateHUD();
    toast(`Read Aloud ${state.readAloud ? "On" : "Off"}`);
    if(state.readAloud) speak("Read aloud is on.");
  });

  $("#btnReset").addEventListener("click", ()=>{
    clearEnergyTimer();
    resetAll();
    setScreen("home");
  });

  // Teacher controls
  $("#className").addEventListener("input", (e)=>{
    state.className = e.target.value;
    save();
  });

  $("#btnAddStudent").addEventListener("click", ()=>{
    addStudent($("#studentName").value);
    $("#studentName").value = "";
  });

  $("#btnExportCSV").addEventListener("click", exportCSV);
  $("#btnResetClass").addEventListener("click", resetClass);
  $("#btnProjector").addEventListener("click", toggleProjector);

  // Apply projector mode if saved
  document.body.style.zoom = state.projectorMode ? "1.15" : "1.0";

  renderAll();
  setScreen("home");
}

window.addEventListener("beforeunload", clearEnergyTimer);
init();