const app = document.getElementById("app");
const KEY = "po-anfitrion";
let sess = LS.get(KEY);            // { code, hostKey }
let catalog = null, hv = null, offset = 0, pollT = null, busy = false, showRoles = false, stageSig = "";
let rolesSig = "";
let pick = { level: 1, wordId: null, minutes: null, mode: null };

const NEXT_LABEL = { lobby: "Empezar juego", pistas: "Empezar a conversar", chat: "Pasar a adivinar",
  adivinar: "Pasar a votar", votar: "Ver resultado" };

/* ---------- Preparar partida ---------- */
async function showSetup(mode = "new") {
  clearTimeout(pollT);
  if (!catalog) {
    app.innerHTML = `<p class="lead">Cargando…</p>`;
    try { catalog = await api("catalog"); }
    catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reintentar</button>`; return; }
  }
  if (!pick.minutes) pick.minutes = { ...catalog.levels.find(l => l.n === pick.level).minutes };
  if (!pick.mode) pick.mode = catalog.levels.find(l => l.n === pick.level).defaultMode;
  app.innerHTML = `
    <section class="setup">
      <h1 class="title">La palabra<br>oculta</h1>
      <p class="lead">${mode === "reset" ? "Elegí la palabra para la próxima ronda. Los chicos siguen conectados." : "Elegí el grupo y la palabra secreta. Después proyectá esta pantalla."}</p>
      <p><span class="warn">Hacé esto sin proyectar: acá se ve la palabra.</span></p>
      <h2>Grupo</h2><div class="choice" id="levels"></div>
      <h2>Forma de jugar</h2><div class="choice" id="modes"></div>
      <p class="muted" id="modeHint"></p>
      <h2>Palabra secreta</h2><div class="choice" id="words"></div>
      <h2>Minutos por fase</h2>
      <div class="mins">
        ${["pistas", "chat", "adivinar", "votar"].map(ph => `<label>${PHASES[ph]}
          <input type="number" min="1" max="30" data-min="${ph}"></label>`).join("")}
      </div>
      <p class="muted" id="total"></p>
      <p><button class="btn big" id="go">${mode === "reset" ? "Preparar ronda" : "Crear sala"}</button>
      ${mode === "reset" ? `<button class="btn ghost" id="cancel">Volver</button>` : ""}</p>
      <p class="error" id="err"></p>
    </section>`;
  const drawLevels = () => {
    document.getElementById("levels").innerHTML = catalog.levels.map(l =>
      `<button class="chip-btn ${l.n === pick.level ? "sel" : ""}" data-level="${l.n}">${esc(l.name)}</button>`).join("");
    const words = catalog.words.filter(w => w.level === pick.level);
    if (!words.some(w => w.id === pick.wordId)) pick.wordId = words[0].id;
    document.getElementById("words").innerHTML = words.map(w =>
      `<button class="chip-btn ${w.id === pick.wordId ? "sel" : ""}" data-word="${w.id}">${w.e} ${esc(w.word)}</button>`).join("");
    document.getElementById("modes").innerHTML = [["impostor", "Impostor"], ["pistas", "Pistas"]].map(([m, t]) =>
      `<button class="chip-btn ${m === pick.mode ? "sel" : ""}" data-mode="${m}">${t}</button>`).join("");
    document.getElementById("modeHint").textContent = pick.mode === "impostor"
      ? "Todos ven la palabra menos el saboteador. La describen sin decirla y votan quién no la sabe."
      : "Nadie sabe la palabra. Cada uno tiene una pista, juntan todas para adivinarla y votan al saboteador.";
    app.querySelectorAll("[data-min]").forEach(i => i.value = pick.minutes[i.dataset.min]);
    document.querySelector('[data-min="adivinar"]').closest("label").hidden = pick.mode === "impostor";
    drawTotal();
  };
  const drawTotal = () => {
    const t = Object.entries(pick.minutes).reduce((a, [k, v]) => a + (k === "adivinar" && pick.mode === "impostor" ? 0 : Number(v || 0)), 0);
    document.getElementById("total").textContent = `En total: unos ${t} minutos.`;
  };
  app.querySelector(".setup").addEventListener("click", e => {
    const l = e.target.closest("[data-level]"), w = e.target.closest("[data-word]"), m = e.target.closest("[data-mode]");
    if (l) { pick.level = Number(l.dataset.level); const L = catalog.levels.find(x => x.n === pick.level);
      pick.minutes = { ...L.minutes }; pick.mode = L.defaultMode; drawLevels(); }
    if (m) { pick.mode = m.dataset.mode; drawLevels(); }
    if (w) { pick.wordId = w.dataset.word; drawLevels(); }
  });
  app.querySelectorAll("[data-min]").forEach(i => i.oninput = () => { pick.minutes[i.dataset.min] = Number(i.value); drawTotal(); });
  drawLevels();
  const cancel = document.getElementById("cancel");
  if (cancel) cancel.onclick = () => { buildRoom(); poll(); };
  document.getElementById("go").onclick = async () => {
    const btn = document.getElementById("go"); btn.disabled = true;
    try {
      const data = { level: pick.level, wordId: pick.wordId, minutes: pick.minutes, mode: pick.mode };
      if (mode === "reset") await api("reset", { ...sess, ...data });
      else { const r = await api("create", data); sess = { code: r.code, hostKey: r.hostKey }; LS.set(KEY, sess); }
      buildRoom(); poll();
    } catch (e) { document.getElementById("err").textContent = e.message; btn.disabled = false; }
  };
}

/* ---------- Pantalla de la sala (para proyectar) ---------- */
function buildRoom() {
  stageSig = ""; hv = null;
  const link = `${location.host}`;
  app.innerHTML = `
    <header class="top">
      <div class="code-box"><small>Código</small><div class="code">${esc(sess.code)}</div></div>
      <p class="join-hint">Entrá a <b>${esc(link)}</b><br>y escribí tu nombre y el código.</p>
      <div class="big-timer" id="timer" aria-live="off"></div>
    </header>
    <ol class="steps" id="steps">${Object.keys(PHASES).map(p => `<li data-step="${p}">${PHASES[p]}</li>`).join("")}</ol>
    <section class="stage" id="stage"><p class="lead">Conectando…</p></section>
    <nav class="controls">
      <button class="btn big" id="nextBtn"></button>
      <button class="btn ghost" id="timeBtn">+1 minuto</button>
      <span class="msg" id="msg"></span><span class="spacer"></span>
      <button class="btn ghost small" id="rolesBtn">👁 Ver pistas</button>
      <button class="btn ghost small" id="againBtn">Otra ronda</button>
      <button class="btn ghost small" id="newBtn">Sala nueva</button>
    </nav>
    <div id="rolesBox"></div>`;
  document.getElementById("nextBtn").onclick = () => act(hv.phase === "lobby" ? "start" : "next");
  document.getElementById("timeBtn").onclick = () => act("addTime");
  document.getElementById("rolesBtn").onclick = () => { showRoles = !showRoles; drawRoles(); };
  document.getElementById("againBtn").onclick = () => {
    if (hv?.phase !== "final" && hv?.phase !== "lobby" && !confirm("¿Cortar esta ronda y empezar otra con los mismos chicos?")) return;
    showSetup("reset");
  };
  document.getElementById("newBtn").onclick = () => {
    if (!confirm("¿Crear una sala nueva? Los chicos de esta sala van a tener que entrar con el código nuevo.")) return;
    LS.del(KEY); sess = null; showSetup("new");
  };
  document.getElementById("stage").addEventListener("click", e => {
    const k = e.target.closest("[data-kick]"), h = e.target.closest("[data-hide]");
    if (k && confirm(`¿Sacar a ${k.dataset.name} de la sala?`)) act("kick", { pid: k.dataset.kick });
    if (h) act("hide", { msgId: h.dataset.hide });
  });
}

async function poll() {
  clearTimeout(pollT);
  if (!sess) return;
  if (!busy) {
    try {
      const v = await api("hostPoll", sess);
      offset = v.now - Date.now(); hv = v; setMsg(""); draw();
    } catch (e) {
      if (e.code === "NO_ROOM" || e.code === "NOT_HOST") { LS.del(KEY); sess = null; return showSetup("new"); }
      setMsg("Reconectando…");
    }
  }
  pollT = setTimeout(poll, 2000);
}
const setMsg = t => { const m = document.getElementById("msg"); if (m) m.textContent = t; };

async function act(action, extra = {}) {
  if (busy) return;
  busy = true;
  const btns = app.querySelectorAll(".controls .btn"); btns.forEach(b => b.disabled = true);
  try { await api(action, { ...sess, ...extra }); setMsg(""); }
  catch (e) { setMsg(e.message); }
  busy = false; btns.forEach(b => b.disabled = false);
  poll();
}

/* ---------- Dibujo ---------- */
function draw() {
  if (!document.getElementById("stage")) return;
  const imp = hv.level.mode === "impostor";
  const order = Object.keys(PHASES).filter(p => !(imp && p === "adivinar")), idx = order.indexOf(hv.phase);
  app.querySelectorAll("[data-step]").forEach(li => {
    const i = order.indexOf(li.dataset.step);
    li.hidden = i < 0;
    li.className = i === idx ? "now" : i < idx ? "past" : "";
  });
  const next = document.getElementById("nextBtn");
  next.hidden = hv.phase === "final";
  next.textContent = imp && hv.phase === "chat" ? "Pasar a votar" : NEXT_LABEL[hv.phase] || "";
  next.disabled = busy || (hv.phase === "lobby" && hv.players.length < 3);
  document.getElementById("timeBtn").hidden = !hv.endsAt;
  document.title = `${sess.code} · La palabra oculta`;

  const sig = JSON.stringify([hv.phase, hv.players, hv.messages, hv.result]);
  if (sig !== stageSig) { stageSig = sig; document.getElementById("stage").innerHTML = stageHTML(); }
  drawRoles();
}

const inGame = () => hv.players.filter(p => p.inGame);
function wallHTML() {
  if (!hv.messages.length) return `<p class="empty-wall">${hv.phase === "chat" ? "Todavía no hay mensajes." : "No hubo mensajes."}</p>`;
  return `<div class="wall">${hv.messages.map(m => `<div class="post ${m.hidden ? "hidden" : ""}">
    <span class="pn">${esc(m.name)}</span><span class="pt">${esc(m.text)}</span>
    <button class="hide" data-hide="${m.id}">${m.hidden ? "Mostrar" : "Ocultar"}</button></div>`).join("")}</div>`;
}
function progressHTML(field, verb) {
  const list = inGame(), n = list.filter(p => p[field]).length;
  const pct = list.length ? Math.round(n / list.length * 100) : 0;
  return `<p class="progress">${n} de ${list.length} ya ${verb}</p>
    <div class="meter"><span style="width:${pct}%"></span></div>
    <div class="chips">${list.map(p => `<span class="chip noX ${p[field] ? "yes" : ""}">${esc(p.name)}</span>`).join("")}</div>`;
}
function bars(rows, cls) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return `<div class="bars">${rows.map(r => `<div class="bar-row ${cls(r)}"><span class="lbl">${esc(r.label ?? r.name)}</span>
    <span class="track"><span class="fill" style="width:${r.count / max * 100}%"></span></span><b>${r.count}</b></div>`).join("")}</div>`;
}
function stageHTML() {
  const p = hv.phase;
  if (p === "lobby") {
    const n = hv.players.length;
    return `<p class="stage-title">${n} ${n === 1 ? "chico conectado" : "chicos conectados"}</p>
      ${n < 3 ? `<p class="muted">Hacen falta al menos 3 para empezar.</p>` : ""}
      <div class="chips">${hv.players.map(pl => `<span class="chip">${esc(pl.name)}
        <button class="x" data-kick="${pl.id}" data-name="${esc(pl.name)}" aria-label="Sacar a ${esc(pl.name)}">✕</button></span>`).join("")}</div>`;
  }
  const imp = hv.level.mode === "impostor";
  if (p === "pistas" && imp) return `<p class="stage-title">Todos ven la palabra… menos ${hv.level.nSab > 1 ? "los saboteadores" : "el saboteador"} 🤫</p>
    <p class="lead">Todavía no se dice nada. Después la van a describir sin decirla.</p>
    <div class="chips">${inGame().map(pl => `<span class="chip noX">${esc(pl.name)}</span>`).join("")}</div>`;
  if (p === "chat" && imp) return `<p class="stage-title">Describan la palabra sin decirla</p>${wallHTML()}`;
  if (p === "votar" && imp) return `<p class="stage-title">¿Quién no sabe la palabra?</p>
    <p class="muted">${hv.level.nSab > 1 ? "Los saboteadores también intentan" : "El saboteador también intenta"} adivinarla para salvarse.</p>
    ${progressHTML("voted", "votaron")}${wallHTML()}`;
  if (p === "pistas") return `<p class="stage-title">Cada uno está leyendo su pista 🕵️</p>
    <p class="lead">Todavía no se dice nada. En un ratito empiezan a conversar.</p>
    <p class="muted">${hv.level.nSab > 1 ? `Entre ustedes hay ${hv.level.nSab} saboteadores con pistas falsas.` : "Entre ustedes hay un saboteador con una pista falsa."}</p>
    <div class="chips">${inGame().map(pl => `<span class="chip noX">${esc(pl.name)}</span>`).join("")}</div>`;
  if (p === "chat") return `<p class="stage-title">Compartan sus pistas</p>${wallHTML()}`;
  if (p === "adivinar") return `<p class="stage-title">¿Cuál es la palabra oculta?</p>${progressHTML("answered", "respondieron")}${wallHTML()}`;
  if (p === "votar") return `<p class="stage-title">¿Quién es ${hv.level.nSab > 1 ? "saboteador" : "el saboteador"}?</p>${progressHTML("voted", "votaron")}${wallHTML()}`;
  const r = hv.result;
  if (!r) return `<p class="lead">Calculando…</p>`;
  const sabText = r.caught >= r.nSab ? (r.nSab > 1 ? "¡Los atraparon a los dos!" : "¡Lo atraparon!")
    : r.caught > 0 ? "Atraparon a uno de los dos." : r.nSab > 1 ? "¡Se escaparon sin que los descubran!" : "¡Se escapó sin que lo descubran!";
  if (imp) {
    const many = r.saboteurs.length > 1;
    return `<div class="reveal">
    <div class="note"><span class="note-emoji">${r.e}</span><p class="note-text">${esc(r.word)}</p></div>
    <div class="res-block">
      <p class="stage-title">${r.caught >= r.nSab ? (many ? "¡Atraparon a los saboteadores!" : "¡Atraparon al saboteador!") : sabText}</p>
      <h3>${many ? "Los saboteadores eran" : "El saboteador era"} ${r.saboteurs.map(esc).join(" y ")}</h3>
      ${r.sabGuesses.map(g => `<p>${esc(g.name)} ${g.guess == null ? "no intentó adivinar." : `dijo “${esc(g.guess)}” ${g.correct ? "y adivinó la palabra ✅" : "y no la adivinó ❌"}`}</p>`).join("")}
      ${r.votes.length ? `<h3>Votos</h3>${bars(r.votes, x => x.saboteur ? "sab" : "")}` : ""}
    </div></div>`;
  }
  return `<div class="reveal">
    <div class="note"><span class="note-emoji">${r.e}</span><p class="note-text">${esc(r.word)}</p></div>
    <div class="res-block">
      <p class="stage-title">${r.guessed ? "¡Descubrieron la palabra!" : "La palabra se escapó esta vez"}</p>
      <p>${r.correct} de ${r.guessers} acertaron.</p>
      ${r.tally.length ? `<h3>Respuestas</h3>${bars(r.tally, x => x.correct ? "hit" : "")}` : ""}
      <h3>${r.saboteurs.length > 1 ? "Los saboteadores eran" : "El saboteador era"} ${r.saboteurs.map(esc).join(" y ")}</h3>
      <p>${sabText}</p>
      ${r.votes.length ? `<h3>Votos</h3>${bars(r.votes, x => x.saboteur ? "sab" : "")}` : ""}
    </div></div>`;
}

function drawRoles() {
  const box = document.getElementById("rolesBox");
  if (!box) return;
  document.getElementById("rolesBtn").textContent = showRoles ? "Ocultar pistas" : "👁 Ver pistas";
  if (!showRoles || !hv) { box.innerHTML = ""; rolesSig = ""; return; }
  const sig = JSON.stringify(hv.roles);
  if (sig === rolesSig) return;
  rolesSig = sig;
  const rows = hv.roles.length
    ? `<table><tr><th>Nombre</th><th>Pista</th></tr>${hv.roles.map(r => `<tr class="${r.saboteur ? "sab" : ""}">
        <td>${esc(r.name)}${r.saboteur ? " 🤫" : ""}</td><td>${r.clue ? `${r.clue.e} ${esc(r.clue.t)}` : "No sabe la palabra"}</td></tr>`).join("")}</table>`
    : `<p class="muted">Las pistas se reparten cuando empieza el juego.</p>`;
  box.innerHTML = `<div class="roles" id="rolesBg"><div class="roles-card">
    <p class="warn">No proyectes esto. Palabra: ${hv.word.e} ${esc(hv.word.word)} (${esc(hv.level.name)})</p>
    ${rows}<p><button class="btn" id="closeRoles">Cerrar</button></p></div></div>`;
  document.getElementById("closeRoles").onclick = () => { showRoles = false; drawRoles(); };
}

setInterval(() => {
  const t = document.getElementById("timer");
  if (!t || !hv) return;
  if (!hv.endsAt) { t.textContent = ""; return; }
  const ms = hv.endsAt - (Date.now() + offset);
  t.textContent = ms > 0 ? fmtTime(ms) : "¡Tiempo!";
  t.classList.toggle("low", ms < 30000);
}, 250);

if (sess) { buildRoom(); poll(); } else showSetup("new");
