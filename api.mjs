import { getStore } from "@netlify/blobs";
import { randomInt } from "node:crypto";

/* ============ CONFIGURACIÓN DE NIVELES ============ */
const LEVELS = {
  1: { name: "Primer grado", saboteurs: 1, msgMode: "emoji", maxMsgs: 5, maxLen: 0, guess: "options", nOptions: 4,
       minutes: { pistas: 2, chat: 6, adivinar: 3, votar: 3 } },
  2: { name: "Segundo y tercero", saboteurs: 1, msgMode: "text", maxMsgs: 3, maxLen: 30, guess: "options", nOptions: 6,
       minutes: { pistas: 3, chat: 10, adivinar: 4, votar: 4 } },
  3: { name: "Cuarto y quinto", saboteurs: 2, msgMode: "text", maxMsgs: 3, maxLen: 40, guess: "text", nOptions: 0,
       minutes: { pistas: 3, chat: 14, adivinar: 5, votar: 5 } },
};

/* Opciones para adivinar (niveles 1 y 2) */
const POOL = {
  1: [
    { id: "mouse", e: "🖱️", t: "Mouse" }, { id: "pantalla", e: "🖥️", t: "Pantalla" },
    { id: "auriculares", e: "🎧", t: "Auriculares" }, { id: "teclado", e: "⌨️", t: "Teclado" },
    { id: "impresora", e: "🖨️", t: "Impresora" }, { id: "camara", e: "📷", t: "Cámara" },
  ],
  2: [
    { id: "teclado", e: "⌨️", t: "Teclado" }, { id: "wifi", e: "📶", t: "WiFi" },
    { id: "impresora", e: "🖨️", t: "Impresora" }, { id: "mouse", e: "🖱️", t: "Mouse" },
    { id: "pendrive", e: "💾", t: "Pendrive" }, { id: "parlante", e: "🔊", t: "Parlante" },
    { id: "camara", e: "📷", t: "Cámara" }, { id: "bateria", e: "🔋", t: "Batería" },
  ],
};

/* Emojis que puede mandar primer grado */
const PALETTE = ["👍", "👎", "🤔", "❓", "👀", "✋", "🖱️", "🖥️", "🎧", "⌨️", "👂", "🎵", "🔊", "💡"];

/* Palabras: 8 pistas verdaderas y 2 falsas (saboteadores) */
const WORDS = {
  /* ---- Nivel 1 ---- */
  mouse: { level: 1, word: "Mouse", e: "🖱️", accept: ["mouse", "raton", "maus"],
    clues: [
      { e: "🖐️", t: "Lo movés con la mano" }, { e: "👆", t: "Tiene botones para hacer clic" },
      { e: "↔️", t: "Mueve la flechita de la pantalla" }, { e: "⚙️", t: "Tiene una ruedita" },
      { e: "🐭", t: "Su nombre quiere decir ratón" }, { e: "🖥️", t: "Está al lado de la compu" },
      { e: "💡", t: "Algunos tienen una luz abajo" }, { e: "🔌", t: "Puede tener cable o no" } ],
    fakes: [ { e: "🎵", t: "Hace sonar música" }, { e: "👀", t: "Se mira como una tele" } ] },
  pantalla: { level: 1, word: "Pantalla", e: "🖥️", accept: ["pantalla", "monitor"],
    clues: [
      { e: "👀", t: "La mirás para ver cosas" }, { e: "🌈", t: "Muestra colores y dibujos" },
      { e: "📺", t: "Se parece a una tele" }, { e: "💡", t: "Se prende y da luz" },
      { e: "🎬", t: "Ahí ves videos" }, { e: "↖️", t: "Ahí aparece la flechita" },
      { e: "⬛", t: "Es un rectángulo grande" }, { e: "🔌", t: "Se enchufa" } ],
    fakes: [ { e: "🖐️", t: "La movés con la mano por la mesa" }, { e: "👂", t: "Va en las orejas" } ] },
  auriculares: { level: 1, word: "Auriculares", e: "🎧", accept: ["auriculares", "auricular"],
    clues: [
      { e: "👂", t: "Se ponen en las orejas" }, { e: "🎵", t: "Por ahí escuchás música" },
      { e: "🤫", t: "Solo los escuchás vos" }, { e: "✌️", t: "Son dos, uno para cada oreja" },
      { e: "🔊", t: "Sale sonido" }, { e: "🎮", t: "Se usan para jugar y hablar" },
      { e: "〰️", t: "Pueden tener cable" }, { e: "🎤", t: "Algunos tienen micrófono" } ],
    fakes: [ { e: "👀", t: "Muestran dibujos" }, { e: "🔤", t: "Tienen letras para escribir" } ] },

  /* ---- Nivel 2 ---- */
  teclado: { level: 2, word: "Teclado", e: "⌨️", accept: ["teclado"],
    clues: [
      { e: "🔤", t: "Tiene teclas con letras" }, { e: "✍️", t: "Sirve para escribir" },
      { e: "➖", t: "Tiene una tecla larga para el espacio" }, { e: "↩️", t: "Tiene la tecla Enter" },
      { e: "🔢", t: "También tiene números" }, { e: "🔌", t: "Se conecta a la compu" },
      { e: "🔤", t: "Empieza con T" }, { e: "7️⃣", t: "Tiene 7 letras" } ],
    fakes: [ { e: "🎬", t: "Muestra videos y fotos" }, { e: "🔤", t: "Empieza con M" } ] },
  wifi: { level: 2, word: "WiFi", e: "📶", accept: ["wifi", "wi-fi", "guifi"],
    clues: [
      { e: "📶", t: "Te conecta a internet sin cables" }, { e: "📡", t: "Sale de un router" },
      { e: "🔑", t: "Puede tener contraseña" }, { e: "🐢", t: "Si te alejás, anda más lento" },
      { e: "〰️", t: "Se dibuja con rayitas curvas" }, { e: "🏫", t: "Hay en escuelas y bares" },
      { e: "🔤", t: "Empieza con W" }, { e: "4️⃣", t: "Tiene 4 letras" } ],
    fakes: [ { e: "🔌", t: "Necesita un cable para andar" }, { e: "🔤", t: "Empieza con B" } ] },
  impresora: { level: 2, word: "Impresora", e: "🖨️", accept: ["impresora"],
    clues: [
      { e: "📄", t: "Pasa lo de la compu al papel" }, { e: "🖋️", t: "Usa tinta" },
      { e: "🌈", t: "Puede hacerlo en colores" }, { e: "🔊", t: "Hace ruido cuando trabaja" },
      { e: "📃", t: "Hay que ponerle hojas" }, { e: "📚", t: "Sirve para la tarea impresa" },
      { e: "🔤", t: "Empieza con I" }, { e: "9️⃣", t: "Tiene 9 letras" } ],
    fakes: [ { e: "👂", t: "Se pone en las orejas" }, { e: "5️⃣", t: "Tiene 5 letras" } ] },

  /* ---- Nivel 3 ---- */
  contrasena: { level: 3, word: "Contraseña", e: "🔑", accept: ["contrasena", "contraseña", "clave", "password"],
    clues: [
      { e: "🛡️", t: "Protege tus cuentas" }, { e: "🤐", t: "No se la tenés que contar a nadie" },
      { e: "🔣", t: "Es mejor con letras, números y símbolos" }, { e: "🚪", t: "Se escribe al iniciar sesión" },
      { e: "⚫", t: "Al escribirla se ve con puntitos" }, { e: "🔄", t: "Si la olvidás, la podés cambiar" },
      { e: "🔟", t: "Tiene 10 letras" }, { e: "🔤", t: "Empieza con C" } ],
    fakes: [ { e: "🔌", t: "Se conecta con un cable" }, { e: "8️⃣", t: "Tiene 8 letras" } ] },
  router: { level: 3, word: "Router", e: "📡", accept: ["router", "ruter", "rauter", "enrutador"],
    clues: [
      { e: "🏠", t: "Reparte internet en tu casa" }, { e: "💡", t: "Tiene lucecitas que titilan" },
      { e: "📡", t: "Muchos tienen antenas" }, { e: "📶", t: "De él sale el WiFi" },
      { e: "🔄", t: "Si lo reiniciás, a veces anda mejor" }, { e: "🔌", t: "Le llega un cable de la empresa de internet" },
      { e: "6️⃣", t: "Tiene 6 letras" }, { e: "🔤", t: "Empieza con R" } ],
    fakes: [ { e: "🖨️", t: "Sirve para imprimir hojas" }, { e: "🔤", t: "Empieza con M" } ] },
  virus: { level: 3, word: "Virus", e: "🦠", accept: ["virus", "virus informatico", "malware"],
    clues: [
      { e: "🦠", t: "Es un programa que daña la compu" }, { e: "📥", t: "Puede llegar en un archivo descargado" },
      { e: "🛡️", t: "El antivirus lo combate" }, { e: "🕵️", t: "Puede robar o borrar datos" },
      { e: "🔁", t: "Se copia a otras compus" }, { e: "⚠️", t: "Por eso no hay que abrir links raros" },
      { e: "5️⃣", t: "Tiene 5 letras" }, { e: "🔤", t: "Empieza con V" } ],
    fakes: [ { e: "🖐️", t: "Es una parte que se puede tocar" }, { e: "7️⃣", t: "Tiene 7 letras" } ] },
};

const ORDER = ["lobby", "pistas", "chat", "adivinar", "votar", "final"];
const TIMED = ["pistas", "chat", "adivinar", "votar"];

/* ============ UTILIDADES ============ */
class GameError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max).trim();
const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rid = (n, chars = "abcdefghijkmnpqrstuvwxyz23456789") => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
const rk = code => `room/${code}`;
const pk = (code, id) => `players/${code}/${id}`;
const store = () => getStore({ name: "palabra-oculta", consistency: "strong" });

function minutesFrom(input, level) {
  const def = LEVELS[level].minutes, out = {};
  for (const ph of TIMED) {
    const n = Math.round(Number(input?.[ph]));
    out[ph] = Number.isFinite(n) && n >= 1 && n <= 30 ? n : def[ph];
  }
  return out;
}
function checkSetup(level, wordId) {
  level = Number(level);
  if (!LEVELS[level]) throw new GameError("Elegí un grupo", "BAD");
  const w = WORDS[wordId];
  if (!w || w.level !== level) throw new GameError("Elegí una palabra de ese grupo", "BAD");
  return level;
}
async function loadRoom(s, code) {
  code = clean(code, 6).toUpperCase();
  const room = code ? await s.get(rk(code), { type: "json" }) : null;
  if (!room) throw new GameError("No hay ninguna sala con ese código", "NO_ROOM");
  return room;
}
async function loadHostRoom(s, b) {
  const room = await loadRoom(s, b.code);
  if (!b.hostKey || b.hostKey !== room.hostKey) throw new GameError("Esta pantalla no es la del anfitrión", "NOT_HOST");
  return room;
}
async function readPlayers(s, code) {
  const { blobs } = await s.list({ prefix: `players/${code}/` });
  const list = await Promise.all(blobs.map(b => s.get(b.key, { type: "json" })));
  return list.filter(Boolean).sort((a, b) => a.joinedAt - b.joinedAt);
}
const saveRoom = (s, room) => s.setJSON(rk(room.code), room);
const levelInfo = room => {
  const L = LEVELS[room.level];
  return { n: room.level, name: L.name, msgMode: L.msgMode, maxMsgs: L.maxMsgs, maxLen: L.maxLen, guess: L.guess, nSab: room.nSab || 0 };
};
function allMessages(players) {
  const out = [];
  for (const p of players) for (const m of p.msgs || []) out.push({ id: `${p.id}-${m.i}`, pid: p.id, name: p.name, text: m.text, at: m.at });
  return out.sort((a, b) => a.at - b.at);
}
function isCorrect(room, guess) {
  if (guess == null) return false;
  const w = WORDS[room.wordId];
  if (LEVELS[room.level].guess === "options") return guess === room.wordId;
  return w.accept.map(norm).includes(norm(guess));
}
function makeOptions(level, wordId) {
  const L = LEVELS[level];
  if (L.guess !== "options") return null;
  const pool = POOL[level];
  const right = pool.find(o => o.id === wordId);
  const others = shuffle(pool.filter(o => o.id !== wordId)).slice(0, L.nOptions - 1);
  return shuffle([right, ...others]);
}
function assignRoles(players, room) {
  const w = WORDS[room.wordId];
  const nSab = players.length >= 8 ? LEVELS[room.level].saboteurs : 1;
  const ids = shuffle(players.map(p => p.id));
  const clues = shuffle(w.clues);
  const assign = {};
  ids.forEach((id, i) => {
    assign[id] = i < nSab
      ? { saboteur: true, clue: w.fakes[i % w.fakes.length] }
      : { saboteur: false, clue: clues[(i - nSab) % clues.length] };
  });
  return { assign, nSab };
}
function computeResult(room, players) {
  const w = WORDS[room.wordId];
  const assign = room.secret.assign;
  const inGame = players.filter(p => assign[p.id]);
  const guessers = inGame.filter(p => !assign[p.id].saboteur);
  const opts = room.options || [];
  const tallyMap = new Map();
  let correct = 0, answered = 0;
  for (const p of guessers) {
    if (p.guess == null) continue;
    answered++;
    const ok = isCorrect(room, p.guess);
    if (ok) correct++;
    const key = opts.length ? p.guess : norm(p.guess);
    const label = opts.length ? (opts.find(o => o.id === p.guess)?.t || p.guess) : clean(p.guess, 30).toLowerCase();
    const cur = tallyMap.get(key) || { label, count: 0, correct: ok };
    cur.count++; tallyMap.set(key, cur);
  }
  const votes = new Map(inGame.map(p => [p.id, 0]));
  for (const p of inGame) if (p.vote && votes.has(p.vote)) votes.set(p.vote, votes.get(p.vote) + 1);
  const voteTally = inGame.map(p => ({ name: p.name, count: votes.get(p.id), saboteur: assign[p.id].saboteur }))
    .sort((a, b) => b.count - a.count);
  const nSab = room.nSab || 1;
  const caught = voteTally.slice(0, nSab).filter(v => v.count > 0 && v.saboteur).length;
  return {
    word: w.word, e: w.e, correct, answered, guessers: guessers.length,
    guessed: guessers.length > 0 && correct > guessers.length / 2,
    tally: [...tallyMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    saboteurs: inGame.filter(p => assign[p.id].saboteur).map(p => p.name),
    votes: voteTally.filter(v => v.count > 0).slice(0, 8),
    caught, nSab,
  };
}

/* ============ ACCIONES ============ */
const ACTIONS = {
  /* Datos para armar el panel */
  async catalog() {
    const levels = Object.entries(LEVELS).map(([n, L]) => ({ n: Number(n), name: L.name, minutes: L.minutes }));
    const words = Object.entries(WORDS).map(([id, w]) => ({ id, level: w.level, word: w.word, e: w.e }));
    return { levels, words };
  },

  /* ---------- Anfitrión ---------- */
  async create(s, b) {
    const level = checkSetup(b.level, b.wordId);
    let code;
    for (let i = 0; i < 20; i++) {
      code = rid(4, "ABCDEFGHJKLMNPQRSTUVWXYZ");
      if (!(await s.get(rk(code)))) break;
    }
    const room = { code, hostKey: rid(16), level, wordId: b.wordId, minutes: minutesFrom(b.minutes, level),
      phase: "lobby", endsAt: null, createdAt: Date.now(), secret: {}, options: null, nSab: 0, hidden: [],
      pub: { players: [], messages: [] }, result: null };
    await saveRoom(s, room);
    return { code, hostKey: room.hostKey };
  },

  async hostPoll(s, b) {
    const room = await loadHostRoom(s, b);
    const players = await readPlayers(s, room.code);
    const assign = room.secret.assign || {};
    const msgs = allMessages(players);
    const started = room.phase !== "lobby";
    const pub = {
      players: players.filter(p => !started || assign[p.id]).map(p => ({ id: p.id, name: p.name })),
      messages: msgs.filter(m => !room.hidden.includes(m.id)),
    };
    if (JSON.stringify(pub) !== JSON.stringify(room.pub)) { room.pub = pub; await saveRoom(s, room); }
    const w = WORDS[room.wordId];
    return {
      now: Date.now(), code: room.code, phase: room.phase, endsAt: room.endsAt, minutes: room.minutes,
      level: levelInfo(room), word: { id: room.wordId, word: w.word, e: w.e },
      players: players.map(p => ({ id: p.id, name: p.name, inGame: !!assign[p.id],
        answered: p.guess != null, voted: p.vote != null, msgs: (p.msgs || []).length,
        saboteur: !!assign[p.id]?.saboteur })),
      messages: msgs.map(m => ({ ...m, hidden: room.hidden.includes(m.id) })),
      roles: players.filter(p => assign[p.id]).map(p => ({ name: p.name, ...assign[p.id] })),
      result: room.result,
    };
  },

  async start(s, b) {
    const room = await loadHostRoom(s, b);
    if (room.phase !== "lobby") throw new GameError("El juego ya empezó", "BAD");
    const players = await readPlayers(s, room.code);
    if (players.length < 3) throw new GameError("Se necesitan al menos 3 jugadores", "BAD");
    const { assign, nSab } = assignRoles(players, room);
    room.secret = { assign }; room.nSab = nSab;
    room.options = makeOptions(room.level, room.wordId);
    room.phase = "pistas"; room.endsAt = Date.now() + room.minutes.pistas * 60000;
    room.pub = { players: players.map(p => ({ id: p.id, name: p.name })), messages: [] };
    await saveRoom(s, room);
    return {};
  },

  async next(s, b) {
    const room = await loadHostRoom(s, b);
    const i = ORDER.indexOf(room.phase);
    if (i < 1 || i >= ORDER.length - 1) throw new GameError("No hay una fase siguiente", "BAD");
    const phase = ORDER[i + 1];
    room.phase = phase;
    room.endsAt = TIMED.includes(phase) ? Date.now() + room.minutes[phase] * 60000 : null;
    if (phase === "final") room.result = computeResult(room, await readPlayers(s, room.code));
    await saveRoom(s, room);
    return {};
  },

  async addTime(s, b) {
    const room = await loadHostRoom(s, b);
    if (!room.endsAt) throw new GameError("Esta fase no tiene tiempo", "BAD");
    room.endsAt = Math.max(room.endsAt, Date.now()) + 60000;
    await saveRoom(s, room);
    return {};
  },

  async kick(s, b) {
    const room = await loadHostRoom(s, b);
    await s.delete(pk(room.code, clean(b.pid, 20)));
    if (room.secret.assign) delete room.secret.assign[b.pid];
    await saveRoom(s, room);
    return {};
  },

  async hide(s, b) {
    const room = await loadHostRoom(s, b);
    const id = clean(b.msgId, 40);
    room.hidden = room.hidden.includes(id) ? room.hidden.filter(x => x !== id) : [...room.hidden, id];
    await saveRoom(s, room);
    return {};
  },

  /* Otra ronda con los mismos jugadores */
  async reset(s, b) {
    const room = await loadHostRoom(s, b);
    const level = checkSetup(b.level, b.wordId);
    const players = await readPlayers(s, room.code);
    await Promise.all(players.map(p => s.setJSON(pk(room.code, p.id), { ...p, msgs: [], guess: null, vote: null })));
    Object.assign(room, { level, wordId: b.wordId, minutes: minutesFrom(b.minutes, level), phase: "lobby",
      endsAt: null, secret: {}, options: null, nSab: 0, hidden: [], result: null,
      pub: { players: players.map(p => ({ id: p.id, name: p.name })), messages: [] } });
    await saveRoom(s, room);
    return {};
  },

  /* ---------- Jugadores ---------- */
  async join(s, b) {
    const room = await loadRoom(s, b.code);
    const prevId = clean(b.playerId, 20);
    if (prevId) {
      const prev = await s.get(pk(room.code, prevId), { type: "json" });
      if (prev) return { code: room.code, playerId: prev.id, name: prev.name };
    }
    if (room.phase !== "lobby") throw new GameError("La partida ya empezó. Esperá la próxima ronda.", "STARTED");
    let name = clean(b.name, 16);
    if (!name) throw new GameError("Escribí tu nombre", "BAD");
    const players = await readPlayers(s, room.code);
    if (players.length >= 40) throw new GameError("La sala está llena", "FULL");
    const taken = new Set(players.map(p => p.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      let n = 2; while (taken.has(`${name} ${n}`.toLowerCase())) n++;
      name = `${name} ${n}`;
    }
    const p = { id: rid(10), name, joinedAt: Date.now(), msgs: [], guess: null, vote: null };
    await s.setJSON(pk(room.code, p.id), p);
    return { code: room.code, playerId: p.id, name };
  },

  async poll(s, b) {
    const room = await loadRoom(s, b.code);
    const me = await s.get(pk(room.code, clean(b.playerId, 20)), { type: "json" });
    if (!me) throw new GameError("No estás en esta sala", "NO_PLAYER");
    const L = LEVELS[room.level];
    const a = room.secret.assign?.[me.id] || null;
    const view = {
      now: Date.now(), phase: room.phase, endsAt: room.endsAt, level: levelInfo(room),
      players: room.pub.players, messages: room.pub.messages,
      me: { id: me.id, name: me.name, inGame: !!a, clue: a?.clue || null, saboteur: !!a?.saboteur,
        msgsLeft: L.maxMsgs - (me.msgs || []).length, guess: me.guess, vote: me.vote },
      palette: L.msgMode === "emoji" ? PALETTE : null,
      options: ["adivinar", "votar", "final"].includes(room.phase) ? room.options : null,
      result: room.phase === "final" ? room.result : null,
    };
    if (room.phase === "final" && a && !a.saboteur) view.me.correct = isCorrect(room, me.guess);
    if (room.phase === "final" && a) view.me.caughtMe = a.saboteur && room.result?.votes.slice(0, room.nSab).some(v => v.name === me.name);
    return view;
  },

  async leave(s, b) {
    const room = await loadRoom(s, b.code);
    if (room.phase === "lobby") await s.delete(pk(room.code, clean(b.playerId, 20)));
    return {};
  },

  async msg(s, b) {
    const room = await loadRoom(s, b.code);
    if (room.phase !== "chat") throw new GameError("Ahora no se pueden mandar mensajes", "PHASE");
    const key = pk(room.code, clean(b.playerId, 20));
    const me = await s.get(key, { type: "json" });
    const a = me && room.secret.assign?.[me.id];
    if (!a) throw new GameError("No estás jugando esta ronda", "NO_PLAYER");
    const L = LEVELS[room.level];
    if ((me.msgs || []).length >= L.maxMsgs) throw new GameError("Ya usaste todos tus mensajes", "LIMIT");
    let text;
    if (L.msgMode === "emoji") {
      if (b.kind === "clue") text = `${a.clue.e} ${a.clue.t}`;
      else if (PALETTE.includes(b.text)) text = b.text;
      else throw new GameError("Elegí un dibujito", "BAD");
    } else {
      text = clean(b.text, L.maxLen);
      if (!text) throw new GameError("Escribí algo antes de enviar", "BAD");
    }
    me.msgs = [...(me.msgs || []), { i: (me.msgs || []).length, text, at: Date.now() }];
    await s.setJSON(key, me);
    return { msgsLeft: L.maxMsgs - me.msgs.length };
  },

  async guess(s, b) {
    const room = await loadRoom(s, b.code);
    if (room.phase !== "adivinar") throw new GameError("Ahora no es momento de adivinar", "PHASE");
    const key = pk(room.code, clean(b.playerId, 20));
    const me = await s.get(key, { type: "json" });
    if (!me || !room.secret.assign?.[me.id]) throw new GameError("No estás jugando esta ronda", "NO_PLAYER");
    let g;
    if (room.options) {
      if (!room.options.some(o => o.id === b.value)) throw new GameError("Elegí una opción", "BAD");
      g = b.value;
    } else {
      g = clean(b.value, 30);
      if (!g) throw new GameError("Escribí la palabra", "BAD");
    }
    me.guess = g;
    await s.setJSON(key, me);
    return {};
  },

  async vote(s, b) {
    const room = await loadRoom(s, b.code);
    if (room.phase !== "votar") throw new GameError("Ahora no es momento de votar", "PHASE");
    const key = pk(room.code, clean(b.playerId, 20));
    const me = await s.get(key, { type: "json" });
    const assign = room.secret.assign || {};
    if (!me || !assign[me.id]) throw new GameError("No estás jugando esta ronda", "NO_PLAYER");
    if (!assign[b.target] || b.target === me.id) throw new GameError("Elegí a otra persona", "BAD");
    me.vote = b.target;
    await s.setJSON(key, me);
    return {};
  },
};

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Usá POST" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Datos inválidos" }, 400); }
  const fn = Object.hasOwn(ACTIONS, body?.action) ? ACTIONS[body.action] : null;
  if (!fn) return json({ ok: false, error: "Acción desconocida" }, 400);
  try {
    return json({ ok: true, ...(await fn(store(), body)) });
  } catch (e) {
    if (e instanceof GameError) return json({ ok: false, error: e.message, code: e.code });
    console.error(e);
    return json({ ok: false, error: "Error del servidor, probá de nuevo" }, 500);
  }
};

export const config = { path: "/api" };
