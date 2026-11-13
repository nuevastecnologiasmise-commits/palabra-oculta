const app = document.getElementById("app");
const KEY = "po-jugador";
let session = SS.get(KEY);          // { code, playerId }
const urlCode = (new URLSearchParams(location.search).get("sala") || "").toUpperCase();
if (session && urlCode && session.code !== urlCode) { SS.del(KEY); session = null; }
let view = null, builtFor = null, offset = 0, pollT = null, lastFeed = "", sending = false;

/* ---------- Entrar ---------- */
function showJoin(msg = "") {
  clearTimeout(pollT); builtFor = null; view = null;
  document.body.classList.remove("lvl1");
  const code = (new URLSearchParams(location.search).get("sala") || "").toUpperCase();
  app.innerHTML = `
    <section class="join">
      <h1 class="title">La palabra<br>oculta</h1>
      <p class="lead">Escribí tu nombre y el código que está en el pizarrón.</p>
      <form id="joinForm" class="stack" autocomplete="off">
        <label>Tu nombre<input id="name" maxlength="16" required></label>
        <label>Código de la sala<input id="code" class="code-input" maxlength="4" required value="${esc(code)}"></label>
        <button class="btn big" id="joinBtn">Entrar</button>
        <p class="error" id="err">${esc(msg)}</p>
      </form>
    </section>`;
  document.getElementById("name").focus();
  document.getElementById("joinForm").onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById("joinBtn"), err = document.getElementById("err");
    btn.disabled = true; err.textContent = "";
    try {
      const r = await api("join", { code: document.getElementById("code").value.trim().toUpperCase(),
        name: document.getElementById("name").value });
      session = { code: r.code, playerId: r.playerId }; SS.set(KEY, session);
      poll();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  };
}

/* ---------- Consulta periódica ---------- */
async function poll() {
  clearTimeout(pollT);
  try {
    const v = await api("poll", session);
    offset = v.now - Date.now(); view = v;
    setStatus("");
    render();
  } catch (e) {
    if (e.code === "NO_PLAYER" || e.code === "NO_ROOM") {
      SS.del(KEY); session = null;
      return showJoin(e.code === "NO_PLAYER" ? "Saliste de la sala. Podés volver a entrar." : "Esa sala ya no existe.");
    }
    setStatus("Reconectando…");
  }
  pollT = setTimeout(poll, 2500);
}
const setStatus = t => { const s = document.getElementById("status"); if (s) s.textContent = t; };

/* ---------- Armado de pantallas ---------- */
function shell(inner) {
  return `<header class="bar"><span class="who">${esc(view.me.name)}</span>
    <span class="phase">${PHASES[view.phase]}</span><span class="timer" id="timer"></span></header>
    <div class="screen">${inner}</div><p class="status" id="status"></p>`;
}
const noteHTML = (c, mini = false) => `<div class="note ${mini ? "mini" : ""}">
  <span class="note-emoji" aria-hidden="true">${c.e}</span><p class="note-text">${esc(c.t)}</p>
  <button class="say" type="button" data-say="${esc(c.t)}">🔊 Escuchar</button></div>`;
const sabBanner = () => view.me.saboteur
  ? `<div class="banner"><b>¡Sos ${view.level.nSab > 1 ? "un saboteador" : "el saboteador"}! 🤫</b> Tu pista es falsa. Confundí al grupo sin que te descubran.
     <button class="say" type="button" data-say="Sos el saboteador. Tu pista es falsa. Confundí al grupo sin que te descubran.">🔊 Escuchar</button></div>` : "";
const feedHTML = () => `<ul class="feed" id="feed" aria-live="polite"></ul>`;
const notPlaying = () => shell(`<div class="wait"><div class="big-emoji">👀</div><h2>Esta ronda la mirás desde afuera</h2>
  <p class="muted">Entraste cuando ya había empezado. En la próxima jugás.</p></div>`);

const build = {
  lobby() {
    app.innerHTML = shell(`<div class="wait"><div class="big-emoji">⏳</div>
      <h2>¡Hola, ${esc(view.me.name)}!</h2><p>Esperá a que el profe empiece el juego.</p>
      <p class="muted" id="count"></p>
      <p><button class="btn ghost small" type="button" id="leave">Salir de la sala</button></p></div>`);
    document.getElementById("leave").onclick = leave;
  },
  pistas() {
    if (!view.me.inGame) return app.innerHTML = notPlaying();
    app.innerHTML = shell(`${sabBanner()}${noteHTML(view.me.clue)}
      <p class="hint">${view.me.saboteur ? "Hacé de cuenta que tu pista es verdadera." : "Esta es tu pista. Con las de tus compañeros van a descubrir la palabra oculta."}<br>
      En un ratito van a poder conversar.</p>`);
  },
  chat() {
    if (!view.me.inGame) return app.innerHTML = notPlaying();
    const L = view.level;
    const composer = L.msgMode === "emoji"
      ? `<div class="palette">${view.palette.map(e => `<button class="emo" type="button" data-emo="${e}">${e}</button>`).join("")}</div>
         <button class="btn" type="button" id="shareClue">📝 Mostrar mi pista</button>`
      : `<form class="send" id="sendForm" autocomplete="off"><input id="msg" maxlength="${L.maxLen}" placeholder="Escribí algo sobre tu pista">
         <button class="btn" id="sendBtn">Enviar</button></form>`;
    app.innerHTML = shell(`${noteHTML(view.me.clue, true)}${feedHTML()}
      <div class="composer"><p class="left" id="left"></p>${composer}</div>`);
    const f = document.getElementById("sendForm");
    if (f) f.onsubmit = e => { e.preventDefault(); send({ text: document.getElementById("msg").value }); };
    const sc = document.getElementById("shareClue");
    if (sc) sc.onclick = () => send({ kind: "clue" });
    app.querySelectorAll("[data-emo]").forEach(b => b.onclick = () => send({ text: b.dataset.emo }));
  },
  adivinar() {
    if (!view.me.inGame) return app.innerHTML = notPlaying();
    const opts = view.options;
    const body = opts
      ? `<div class="options">${opts.map(o => `<button class="opt" type="button" data-guess="${o.id}">
          <span class="oe" aria-hidden="true">${o.e}</span>${esc(o.t)}</button>`).join("")}</div>`
      : `<form class="send" id="guessForm" autocomplete="off"><input id="guessIn" maxlength="30" placeholder="La palabra es…">
          <button class="btn">Responder</button></form>`;
    app.innerHTML = shell(`<p class="question">¿Cuál es la palabra oculta?</p>
      ${view.me.saboteur ? `<p class="hint">Respondé igual para disimular: tu respuesta no cuenta.</p>` : ""}
      ${opts && view.level.n === 1 ? `<p class="hint"><button class="say" type="button" id="readOpts">🔊 Escuchar las opciones</button></p>` : ""}
      ${body}<p class="done" id="done"></p>${feedHTML()}`);
    app.querySelectorAll("[data-guess]").forEach(b => b.onclick = () => answer("guess", { value: b.dataset.guess }));
    const gf = document.getElementById("guessForm");
    if (gf) gf.onsubmit = e => { e.preventDefault(); answer("guess", { value: document.getElementById("guessIn").value }); };
    const ro = document.getElementById("readOpts");
    if (ro) ro.onclick = () => speak(opts.map(o => o.t).join(", "));
  },
  votar() {
    if (!view.me.inGame) return app.innerHTML = notPlaying();
    const others = view.players.filter(p => p.id !== view.me.id);
    const q = view.me.saboteur ? "Votá a alguien para disimular" : view.level.nSab > 1
      ? "Hay 2 saboteadores. ¿Quién te parece más sospechoso?" : "¿Quién es el saboteador?";
    app.innerHTML = shell(`<p class="question">${q}</p>
      <div class="options">${others.map(p => `<button class="opt" type="button" data-vote="${p.id}">
        <span class="oe" aria-hidden="true">🕵️</span>${esc(p.name)}</button>`).join("")}</div>
      <p class="done" id="done"></p>${feedHTML()}`);
    app.querySelectorAll("[data-vote]").forEach(b => b.onclick = () => answer("vote", { target: b.dataset.vote }));
  },
  final() {
    const r = view.result, me = view.me;
    if (!r) return app.innerHTML = shell(`<p class="hint">Calculando…</p>`);
    let mine = "";
    if (me.inGame && me.saboteur) mine = me.caughtMe
      ? `<span class="pill bad">Te descubrieron 😅</span>` : `<span class="pill ok">¡No te descubrieron! 😎</span>`;
    else if (me.inGame) mine = me.correct
      ? `<span class="pill ok">¡Adivinaste la palabra! 🎉</span>` : `<span class="pill bad">Esta vez no la adivinaste</span>`;
    app.innerHTML = shell(`<div class="final">
      <p class="verdict">${r.guessed ? "¡El grupo descubrió la palabra!" : "La palabra se escapó esta vez"}</p>
      <div class="note"><span class="note-emoji">${r.e}</span><p class="note-text">${esc(r.word)}</p>
        <button class="say" type="button" data-say="${esc(r.word)}">🔊 Escuchar</button></div>
      <p>${mine}</p>
      <p>${r.saboteurs.length > 1 ? "Los saboteadores eran" : "El saboteador era"}: <b>${r.saboteurs.map(esc).join(" y ")}</b></p>
      <p class="muted">Mirá el pizarrón para ver todos los resultados.</p>
      <p><button class="btn ghost small" type="button" id="leave">Salir del juego</button></p></div>`);
    document.getElementById("leave").onclick = leave;
  },
};

/* ---------- Actualizaciones sin rearmar la pantalla ---------- */
function render() {
  document.body.classList.toggle("lvl1", view.level.n === 1);
  if (builtFor !== view.phase) { builtFor = view.phase; lastFeed = ""; build[view.phase](); }
  update();
}
function update() {
  const count = document.getElementById("count");
  if (count) count.textContent = `${view.players.length} ${view.players.length === 1 ? "conectado" : "conectados"}`;
  renderFeed();
  const left = document.getElementById("left");
  if (left) {
    const n = view.me.msgsLeft;
    left.textContent = n > 0 ? `Te quedan ${n} ${n === 1 ? "mensaje" : "mensajes"}` : "Ya usaste todos tus mensajes. ¡Leé a los demás!";
    app.querySelectorAll(".composer button, .composer input").forEach(el => el.disabled = n <= 0 || sending);
  }
  app.querySelectorAll("[data-guess]").forEach(b => b.classList.toggle("sel", b.dataset.guess === view.me.guess));
  app.querySelectorAll("[data-vote]").forEach(b => b.classList.toggle("sel", b.dataset.vote === view.me.vote));
  const done = document.getElementById("done");
  if (done) {
    if (view.phase === "adivinar" && view.me.guess != null)
      done.textContent = view.options ? "¡Listo! Podés cambiar hasta que termine el tiempo." : `Respondiste: “${view.me.guess}”. Podés cambiarla.`;
    else if (view.phase === "votar" && view.me.vote) done.textContent = "¡Votaste! Podés cambiar hasta que termine el tiempo.";
    else done.textContent = "";
  }
}
function renderFeed() {
  const el = document.getElementById("feed");
  if (!el) return;
  const sig = view.messages.map(m => m.id).join(",");
  if (sig === lastFeed) return;
  lastFeed = sig;
  el.innerHTML = view.messages.length
    ? view.messages.map(m => `<li class="${m.pid === view.me.id ? "mine" : ""}"><b>${esc(m.name)}:</b>${esc(m.text)}</li>`).join("")
    : `<li class="empty">${view.phase === "chat" ? "Todavía no hay mensajes. ¡Mandá el primero!" : "No hubo mensajes."}</li>`;
  el.scrollTop = el.scrollHeight;
}

/* ---------- Acciones ---------- */
function leave() {
  const s = session; SS.del(KEY); session = null; showJoin();
  if (s) api("leave", s).catch(() => {});
}
async function send(data) {
  if (sending) return;
  sending = true; update();
  try {
    const r = await api("msg", { ...session, ...data });
    view.me.msgsLeft = r.msgsLeft;
    const input = document.getElementById("msg"); if (input) input.value = "";
    setStatus("Enviado. Aparece en unos segundos.");
  } catch (e) { setStatus(e.message); }
  sending = false; update();
}
async function answer(action, data) {
  try {
    await api(action, { ...session, ...data });
    if (action === "guess") view.me.guess = data.value; else view.me.vote = data.target;
    update();
  } catch (e) { setStatus(e.message); }
}

app.addEventListener("click", e => { const b = e.target.closest("[data-say]"); if (b) speak(b.dataset.say); });
setInterval(() => {
  const t = document.getElementById("timer");
  if (!t || !view) return;
  if (!view.endsAt) { t.textContent = ""; return; }
  const ms = view.endsAt - (Date.now() + offset);
  t.textContent = ms > 0 ? fmtTime(ms) : "¡Tiempo!";
  t.classList.toggle("low", ms < 30000);
}, 250);

session ? poll() : showJoin();
