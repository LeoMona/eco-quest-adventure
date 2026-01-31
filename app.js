/* Eco Quest Adventure — Cartoon Adventure Edition (Front-end only)
   Features:
   - Story-based quests with biomes (Forest -> Ocean -> City)
   - Animated travel path on the map
   - Advanced Avatar Builder (Option A on Home)
   - Unlockables tied to stars
   - Teacher dashboard with mission assignment + CSV export + printable certificate
*/

/* ==========================
   Helpers
========================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const STORAGE_KEY = "ecoQuestAdventure_cartoon_v2";

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
}

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
  if (!t) return;
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
  } catch (e) { /* ignore */ }
}

/* ==========================
   Data: badges + tips + facts
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
