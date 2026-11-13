/* Utilidades compartidas por jugador y anfitrión */
async function api(action, data = {}) {
  let res, j;
  try {
    res = await fetch("/api", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...data }) });
    j = await res.json();
  } catch {
    const e = new Error("Sin conexión. Revisá internet."); e.code = "NET"; throw e;
  }
  if (!j.ok) { const e = new Error(j.error || "Algo falló"); e.code = j.code; throw e; }
  return j;
}

/* Guardado local: el anfitrión usa localStorage; el jugador, sessionStorage
   (así, al cerrar la pestaña, el próximo chico de esa compu entra limpio) */
const makeStore = name => ({
  get(k) { try { return JSON.parse(window[name].getItem(k)); } catch { return null; } },
  set(k, v) { try { window[name].setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { window[name].removeItem(k); } catch {} },
});
const LS = makeStore("localStorage");
const SS = makeStore("sessionStorage");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang === "es-AR") || voices.find(v => v.lang.startsWith("es"));
    if (v) u.voice = v;
    u.lang = v?.lang || "es-AR";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch {}
}
if ("speechSynthesis" in window) speechSynthesis.getVoices();

const PHASES = {
  lobby: "Sala de espera", pistas: "Leer la pista", chat: "Conversar",
  adivinar: "Adivinar la palabra", votar: "Votar al saboteador", final: "Resultado",
};
