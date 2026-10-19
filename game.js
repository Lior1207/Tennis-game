'use strict';
(() => {
  // ---------- Constants ----------
  const W = 160, H = 240;
  const NET_Y = 120, CX = 80;
  const COURT = { x0: 35, x1: 125, y0: 30, y1: 210 };
  const G = 0.025, NET_H = 6, BOUNCE = 0.7, FRICTION = 0.82;
  const GAMES_TO_WIN = 3;
  const MAX_STRIKES = 3; // training vs Tal ends after 3 misses
  const WARMUP_GOAL = 10;
  const REACH_X = 14, REACH_Y = 10, REACH_Z = 22;
  const POINT_LABELS = ['0', '15', '30', '40'];

  const CHARS = {
    tal: {
      id: 'tal', name: 'טל', female: true, rank: 3,
      desc: 'המאמנת · הרמה הכי גבוהה',
      speed: 1.45, shot: 3.0, err: 0.03, delay: 5,
      hair: '#5a3418', shirt: '#d83a3a', bottom: '#f2f2f2', ponytail: true, visor: null,
      // Tal coaches her opponent: coachM goes to Zion, coachF to Lior
      lines: {
        coach: ['יותר מהאגן', 'להרים את הכדור', 'לעשות תנועה מלאה', 'תמרים מעולים',
          'לא יכולה אני בלימודים', 'צריכה לבדוק אם יש מגרש'],
        coachM: ['תבוא לכדור מלמטה', 'היית מגיע לזה', 'עזוב', 'אל תגזים עם הברך'],
        coachF: ['תבואי לכדור מלמטה', 'היית מגיעה לזה', 'תחשבי שאני האוזנייה', 'תני לכדור עוד רגע'],
      },
    },
    zion: {
      id: 'zion', name: 'ציון', female: false, rank: 1,
      desc: 'שחקן טוב בינוני',
      speed: 1.3, shot: 2.6, err: 0.1, delay: 12, trainCap: 123,
      hair: '#111111', shirt: '#2f6fd8', bottom: '#1c2a5a', ponytail: false, visor: null,
      lines: {
        lose: ['איזה אפס', 'אייי קרעתי את הברך', 'איזה אפס אני לא מאמין'],
        win: ['ממש אלקרז', 'חייבת לי קפה'],
        chat: ['הפיזיותרפיסט לא מרשה', 'עשיתי אימון כוח השבוע', 'הערב טונה היה הטוב בחיי', 'פעם במוסד', 'מקס בונד מקס'],
      },
    },
    lior: {
      id: 'lior', name: 'ליאור', female: true, rank: 2,
      desc: 'שחקנית בינונית · עם מצחייה',
      speed: 1.25, shot: 2.45, err: 0.09, delay: 12, trainCap: 100,
      hair: '#c8903c', shirt: '#9b59d0', bottom: '#2a2a2a', ponytail: true, visor: '#ff6fb1',
      lines: {
        lose: ['סעמק', 'אמאשך', 'המחבט שבור היום'],
        win: ['מי זאת?!', 'ראית איך רצתי לכדור??'],
        chat: ['מתי טסים לרולנד גרוס', 'איזה כיף באוסטרליה', 'ניו זילנד מהממת', 'הסושי ביפן מושלם', 'אני במסאז תאילנדי'],
        chatM: ['תמכור את מאנדיי', 'אתה מגזים', 'חי בסרט', 'קפה עליך'], // only when talking to Zion
      },
    },
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sideOfY = y => (y > NET_Y ? 0 : 1); // 0 = bottom (you), 1 = top
  const inCourt = (x, y) => x >= COURT.x0 - 1 && x <= COURT.x1 + 1 && y >= COURT.y0 - 1 && y <= COURT.y1 + 1;
  const won = (ch, w) => (ch.female ? w + 'ה' : w); // ניצח / ניצחה

  // ---------- Sprites ----------
  const FRONT = [
    '............',
    '....HHHH....',
    '...HHHHHH...',
    '...HSSSSH...',
    '...SKSSKS...',
    '...SSSSSS...',
    '....SSSS....',
    '..TTTTTTTT..',
    '.STTTTTTTTS.',
    '.S.TTTTTT.S.',
    '...TTTTTT...',
    '...PPPPPP...',
  ];
  const BACK = [
    '............',
    '....HHHH....',
    '...HHHHHH...',
    '...HHHHHH...',
    '...SHHHHS...',
    '....SSSS....',
    '....SSSS....',
    '..TTTTTTTT..',
    '.STTTTTTTTS.',
    '.S.TTTTTT.S.',
    '...TTTTTT...',
    '...PPPPPP...',
  ];
  const LEGS = [
    ['...PP..PP...', '...SS..SS...', '...SS..SS...', '...WW..WW...'],
    ['...PP..PP...', '...SS..SS...', '...WW..SS...', '.......WW...'],
    ['...PP..PP...', '...SS..SS...', '...SS..WW...', '...WW.......'],
  ];

  function setPx(rows, r, c, v) {
    rows[r] = rows[r].slice(0, c) + v + rows[r].slice(c + 1);
  }

  function buildRows(ch, view, leg) {
    const rows = (view === 'front' ? FRONT : BACK).slice();
    if (view === 'front') {
      if (ch.ponytail) { setPx(rows, 3, 9, 'H'); setPx(rows, 4, 9, 'H'); setPx(rows, 4, 10, 'H'); setPx(rows, 5, 10, 'H'); }
      if (ch.visor) rows[2] = '..VVVVVVVV..';
    } else {
      if (ch.ponytail) {
        rows[5] = '....HHHH....';
        rows[6] = '....SHHS....';
        rows[7] = '..TTTHHTTT..';
        rows[8] = '.STTTTHTTTS.';
      }
      if (ch.visor) rows[3] = '...VVVVVV...';
    }
    if (ch.female) rows[11] = '..PPPPPPPP..';
    return rows.concat(LEGS[leg]);
  }

  function paletteFor(ch) {
    return { S: '#f8dcc8', K: '#2a1f2d', W: '#ffffff', H: ch.hair, T: ch.shirt, P: ch.bottom, V: ch.visor || '#fff' };
  }

  function rowsToCanvas(rows, pal) {
    const cv = document.createElement('canvas');
    cv.width = rows[0].length; cv.height = rows.length;
    const g = cv.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const k = row[x];
        if (k === '.') continue;
        g.fillStyle = pal[k];
        g.fillRect(x, y, 1, 1);
      }
    });
    return cv;
  }

  const SPRITES = {};
  for (const id in CHARS) {
    const ch = CHARS[id], pal = paletteFor(ch);
    SPRITES[id] = {};
    for (const view of ['front', 'back']) {
      SPRITES[id][view] = [0, 1, 2].map(leg => rowsToCanvas(buildRows(ch, view, leg), pal));
    }
  }
  const portrait = id => SPRITES[id].front[0].toDataURL();

  // Cheering fans that pop up beside the court in training (frame 0 = arms down, 1 = cheering)
  const ANIMALS = {
    kangaroo: {
      name: 'קנגורו',
      pal: { B: '#b0703a', D: '#6e4220', L: '#e8c08a', K: '#1a1a1a' },
      rows: [
        '..D......D..',
        '..DB....BD..',
        '..BB....BB..',
        '...BBBBBB...',
        '..BBKBBKBB..',
        '..BBBBBBBB..',
        '...BBDDBB...',
        '....BBBB....',
        '...BBBBBB...',
        '..BBBLLBBB..',
        '..B.BLLB.B..',
        '....BLLB....',
        '...BB..BB...',
        '..DDD..DDD..',
      ],
      cheer: { 7: '.B..BBBB..B.', 8: '.B.BBBBBB.B.', 9: '...BBLLBB...', 10: '....BLLB....' },
    },
    koala: {
      name: 'קואלה',
      pal: { G: '#8f9499', L: '#d8dcdf', N: '#2a2a2a', K: '#111111' },
      rows: [
        '............',
        '.GG......GG.',
        'GLLG....GLLG',
        'GLLGGGGGGLLG',
        '.GGGGGGGGGG.',
        '..GKGGGGKG..',
        '..GGGNNGGG..',
        '..GGGNNGGG..',
        '...GGGGGG...',
        '..GGLLLLGG..',
        '.GG.LLLL.GG.',
        '...GLLLLG...',
        '...GG..GG...',
        '..GGG..GGG..',
      ],
      cheer: { 8: 'G..GGGGGG..G', 9: 'GG.GLLLLG.GG', 10: '...GLLLLG...' },
    },
    kiwi: {
      name: 'קיווי',
      pal: { B: '#8a6236', D: '#5e4022', Y: '#e8d27a', K: '#111111' },
      rows: [
        '............',
        '............',
        '............',
        '.....BBBB...',
        '....BBBBBB..',
        '...BKBBBBBB.',
        'YYYBBBDBBBBB',
        '...BBBBDBBBB',
        '....BBBBDBB.',
        '.....BBBBB..',
        '......Y.Y...',
        '......Y.Y...',
        '.....YY.YY..',
        '............',
      ],
      cheer: { 6: 'YYYBBBDBBBBB', 10: '.....Y...Y..', 11: '....Y.....Y.', 12: '............' },
    },
  };
  for (const k in ANIMALS) {
    const a = ANIMALS[k];
    const up = a.rows.map((r, i) => a.cheer[i] || r);
    a.frames = [rowsToCanvas(a.rows, a.pal), rowsToCanvas(up, a.pal)];
  }
  const CHEERS = ['יששש!', 'כל הכבוד!', 'וואו!', 'עוד ככה!'];

  // ---------- Audio ----------
  let actx = null, soundOn = true;
  try { soundOn = localStorage.getItem('tennis-sound') !== 'off'; } catch (e) { /* ignore */ }
  function ensureAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  function beep(freq, dur, opts = {}) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime + (opts.at || 0);
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(freq * opts.slide, t + dur);
    g.gain.setValueAtTime(opts.vol || 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    hit: () => beep(660, 0.06, { slide: 1.6 }),
    bounce: () => beep(180, 0.05, { type: 'triangle', vol: 0.08 }),
    net: () => beep(110, 0.18, { type: 'sawtooth', vol: 0.04 }),
    good: () => [523, 659, 784].forEach((f, i) => beep(f, 0.09, { at: i * 0.08 })),
    bad: () => [392, 330, 262].forEach((f, i) => beep(f, 0.12, { at: i * 0.1, type: 'triangle', vol: 0.08 })),
    count: () => beep(988, 0.04, { vol: 0.03 }),
    win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => beep(f, 0.12, { at: i * 0.11 })),
    lose: () => [440, 415, 392, 370, 349].forEach((f, i) => beep(f, 0.16, { at: i * 0.14, type: 'triangle', vol: 0.08 })),
  };

  // ---------- DOM ----------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const bubble = document.getElementById('bubble');
  const msgEl = document.getElementById('msg');
  const overlay = document.getElementById('overlay');
  const tipEl = document.getElementById('tip');
  const btnSound = document.getElementById('btnSound');

  // ---------- Input ----------
  // Touch / mouse: hold and drag on the court, your player runs to your finger.
  // Keyboard: arrows / WASD. Hitting is automatic; tap (or Space) to serve.
  const keys = new Set();
  const input = { mx: 0, my: 0, a: false, touch: null };

  function updateDirs() {
    input.mx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    input.my = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  }

  const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
  window.addEventListener('keydown', e => {
    ensureAudio();
    if (overlay.classList.contains('show')) {
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { moveMenuFocus(e.code === 'ArrowDown' ? 1 : -1); e.preventDefault(); }
      if (e.code === 'Escape' && game && game.paused) resume();
      return;
    }
    if (MOVE_KEYS.includes(e.code)) { keys.add(e.code); input.touch = null; updateDirs(); e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'KeyX') {
      if (!e.repeat) input.a = true;
      e.preventDefault();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
  });
  window.addEventListener('keyup', e => { keys.delete(e.code); updateDirs(); });
  window.addEventListener('blur', () => { keys.clear(); input.touch = null; updateDirs(); });

  let touchPointer = null;
  function touchAt(e) {
    const r = canvas.getBoundingClientRect();
    input.touch = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointerdown', e => {
    ensureAudio();
    touchPointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    touchAt(e);
    input.a = true;
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerId === touchPointer) touchAt(e); });
  const touchEnd = e => {
    if (e.pointerId !== touchPointer) return;
    touchPointer = null; input.touch = null;
  };
  canvas.addEventListener('pointerup', touchEnd);
  canvas.addEventListener('pointercancel', touchEnd);

  document.getElementById('btnPause').addEventListener('click', () => pause());
  function refreshSoundBtn() { btnSound.textContent = soundOn ? '🔊' : '🔇'; }
  btnSound.addEventListener('click', () => {
    soundOn = !soundOn; ensureAudio(); refreshSoundBtn();
    try { localStorage.setItem('tennis-sound', soundOn ? 'on' : 'off'); } catch (e) { /* ignore */ }
  });
  refreshSoundBtn();
  document.addEventListener('contextmenu', e => { if (e.target.closest('#stage')) e.preventDefault(); });

  // ---------- Game state ----------
  let game = null;

  function mkPlayer(ch, side, isCpu) {
    return { ch, side, isCpu, x: CX, y: side === 0 ? 218 : 22, swing: 0, swingHit: false, walk: 0, moving: false, react: 0 };
  }
  function mkBall() {
    return { x: CX, y: 200, z: 10, vx: 0, vy: 0, vz: 0, bounces: 0, hitter: 0, held: true, live: false };
  }

  function loadBest(id) {
    try { return +localStorage.getItem('tennis-best-' + id) || 0; } catch (e) { return 0; }
  }
  function saveBest(id, v) {
    try { localStorage.setItem('tennis-best-' + id, String(v)); } catch (e) { /* ignore */ }
  }

  function startGame(mode, youId, oppId) {
    const you = CHARS[youId], opp = CHARS[oppId];
    game = {
      mode, you, opp,
      players: [mkPlayer(you, 0, false), mkPlayer(opp, 1, true)],
      ball: mkBall(),
      pts: [0, 0], games: [0, 0], server: 0,
      state: 'serve', timer: 0, rally: 0, count: 0,
      cap: you.trainCap || 999, strikes: 0, best: loadBest(youId),
      paused: false, over: false,
    };
    if (mode === 'match') {
      game.winnerId = you.rank > opp.rank ? you.id : opp.id;
      game.loserId = game.winnerId === you.id ? opp.id : you.id;
    }
    hideOverlay();
    hideMsg();
    bubble.hidden = true;
    setupServe();
    if (mode === 'train') say(1, 'יאללה, מתחילים!', 1600);
    if (mode === 'warmup') say(1, 'יאללה, עד 10 ואז קפה קר!', 1800);
  }

  function setupServe() {
    const g = game;
    const coop = g.mode !== 'match'; // training & warm-up: the CPU always feeds
    const s = coop ? 1 : g.server;
    const deuce = (g.pts[0] + g.pts[1]) % 2 === 0;
    const off = deuce ? 1 : -1;
    const [bottom, top] = g.players;
    for (const p of g.players) { p.swing = 0; p.swingHit = false; p.react = 0; }
    if (coop) {
      top.x = CX; top.y = 22; bottom.x = CX; bottom.y = 214;
    } else if (s === 0) {
      bottom.x = CX + off * 14; bottom.y = 218; top.x = CX - off * 24; top.y = 22;
    } else {
      top.x = CX - off * 14; top.y = 22; bottom.x = CX + off * 24; bottom.y = 218;
    }
    g.serverSide = s;
    g.state = 'serve';
    g.timer = 0;
    g.rally = 0;
    Object.assign(g.ball, { held: true, live: false, bounces: 0, hitter: s, vx: 0, vy: 0, vz: 0 });
    renderHud();
  }

  // ---------- Rules / rigging ----------
  function wouldWinMatch(side) {
    const g = game;
    const a = g.pts[side] + 1, o = g.pts[1 - side];
    return a >= 4 && a - o >= 2 && g.games[side] + 1 >= GAMES_TO_WIN;
  }
  // The destined loser can never win the deciding point: their shot dies in the net.
  function mustFail(side) {
    const g = game;
    if (g.mode === 'train') return side === 0 && g.count >= g.cap;
    if (g.mode === 'warmup') return false;
    return g.players[side].ch.id === g.loserId && wouldWinMatch(side);
  }
  // ...and the destined winner never gifts it away with an error.
  function mustBeIn(side) {
    const g = game;
    if (g.mode !== 'match') return side === 1;
    return g.players[side].ch.id === g.winnerId && wouldWinMatch(1 - side);
  }
  function destinedWinnerCpu(p) {
    if (game.mode === 'warmup') return p.isCpu; // the partner reaches everything
    return game.mode === 'train' ? p.ch.id === 'tal' : p.ch.id === game.winnerId;
  }

  // ---------- Physics ----------
  function stepBall(b) {
    b.x += b.vx; b.y += b.vy;
    b.vz -= G; b.z += b.vz;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < 0) {
        b.vz = -b.vz * BOUNCE;
        b.vx *= FRICTION; b.vy *= FRICTION;
        if (b.vz < 0.05) b.vz = 0;
        return 'bounce';
      }
    }
    return null;
  }

  // Launch the ball from its current spot so it lands at (tx, ty).
  function launch(b, tx, ty, speed, fail) {
    const z0 = fail ? 3 : Math.max(b.z, 4);
    const dist = Math.hypot(tx - b.x, ty - b.y);
    let T = Math.max(28, dist / speed);
    let vz = 0;
    for (let i = 0; i < 30; i++) {
      vz = (G * T * T / 2 - z0) / T;
      const vy = (ty - b.y) / T;
      const tNet = vy !== 0 ? (NET_Y - b.y) / vy : -1;
      if (tNet > 0 && tNet < T) {
        const zNet = z0 + vz * tNet - G * tNet * tNet / 2;
        if (zNet < NET_H + 3) { T *= 1.08; continue; }
      }
      break;
    }
    b.vx = (tx - b.x) / T;
    b.vy = (ty - b.y) / T;
    b.vz = fail ? 0.08 : vz;
    b.z = z0;
  }

  // h: -1 left / 0 middle / 1 right (screen), deep: bool
  function hitBall(p, o) {
    const g = game, b = g.ball, side = p.side;
    let tx, d;
    if (o.feedX !== undefined) {
      tx = o.feedX; d = o.depth;
    } else {
      if (o.h < 0) tx = o.sharp ? rand(39, 46) : rand(45, 56);
      else if (o.h > 0) tx = o.sharp ? rand(114, 121) : rand(104, 115);
      else tx = rand(64, 96);
      d = o.serve ? rand(30, 46) : o.deep ? rand(58, 84) : rand(26, 46);
      if (o.serve) tx = o.serveX;
      tx += (Math.random() * 2 - 1) * (o.spread || 0);
      if (o.error) {
        if (Math.random() < 0.6) tx = tx < CX ? rand(22, 32) : rand(128, 138);
        else d = rand(94, 104);
      }
    }
    if (mustBeIn(side)) { tx = clamp(tx, 40, 120); d = clamp(d, 22, 84); }
    const ty = side === 0 ? NET_Y - d : NET_Y + d;
    const fail = mustFail(side);
    launch(b, tx, ty, o.speed, fail);
    b.hitter = side; b.bounces = 0; b.held = false; b.live = true;
    p.swing = 16; p.swingHit = true;
    g.rally++;
    const other = g.players[1 - side];
    other.react = other.isCpu ? (destinedWinnerCpu(other) ? 0 : other.ch.delay) : 0;
    sfx.hit();
  }

  function canReach(p, b) {
    return !b.held && b.live && b.hitter !== p.side && sideOfY(b.y) === p.side &&
      Math.abs(b.x - p.x) < REACH_X && Math.abs(b.y - (p.y - 2)) < REACH_Y && b.z < REACH_Z;
  }

  function userShot(p) {
    const b = game.ball;
    const q = Math.min(1, Math.abs(b.x - p.x) / REACH_X); // 0 = perfect contact
    const opp = game.players[1 - p.side];
    if (game.mode === 'warmup') {
      // Cooperative rally: send it back to your partner
      const miss = q > 0.85 && Math.random() < 0.3;
      hitBall(p, {
        feedX: miss ? (opp.x < CX ? rand(20, 30) : rand(130, 140)) : clamp(opp.x + rand(-10, 10) * (1 + q), 40, 120),
        depth: rand(55, 80), speed: p.ch.shot * 0.8,
      });
      return;
    }
    let h = input.mx > 0.3 ? 1 : input.mx < -0.3 ? -1 : 0;
    if (!input.mx) h = Math.random() < 0.55 ? (opp.x < CX ? 1 : -1) : pick([-1, 0, 1]);
    const deep = input.my > 0.3 ? false : Math.random() < 0.85;
    hitBall(p, {
      h, deep, speed: p.ch.shot * (deep ? 1 : 0.8), spread: 3 + q * 12,
      sharp: q < 0.4, error: q > 0.85 && Math.random() < 0.3,
    });
  }

  function cpuShot(p) {
    const g = game, opp = g.players[1 - p.side];
    if (g.mode !== 'match' && p.side === 1) {
      const lvl = g.mode === 'train' ? Math.min(1, g.count / 120) : 0;
      hitBall(p, {
        feedX: clamp(opp.x + rand(-24 - lvl * 16, 24 + lvl * 16), 44, 116),
        depth: rand(52, 82), speed: 2.0 + lvl * 0.7,
      });
      return;
    }
    const boss = destinedWinnerCpu(p);
    const h = Math.random() < (boss ? 0.75 : 0.5) ? (opp.x < CX ? 1 : -1) : pick([-1, 0, 1]);
    const deep = Math.random() < 0.8;
    const errP = boss ? p.ch.err * 0.5 : p.ch.err * 1.6;
    const speedMul = boss ? 1 + Math.min(0.45, g.rally * 0.035) : 0.95;
    hitBall(p, {
      h, deep, speed: p.ch.shot * speedMul * (deep ? 1 : 0.8),
      sharp: boss ? g.rally > 3 : Math.random() < 0.3,
      spread: boss ? 2 : 6, error: Math.random() < errP,
    });
  }

  function cpuServe(p) {
    hitBall(p, { serve: true, serveX: p.x > CX ? rand(50, 64) : rand(96, 110), speed: p.ch.shot * 1.05, h: 0 });
  }

  function predict(side) {
    const b = game.ball;
    const s = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz };
    let bounces = b.bounces, since = -1, last = null;
    for (let i = 0; i < 300; i++) {
      if (stepBall(s)) { bounces++; if (bounces >= 2) break; }
      if (s.y < -10 || s.y > H + 10) break;
      if (sideOfY(s.y) === side) {
        last = { x: s.x, y: s.y };
        if (bounces >= 1 && ++since >= 8) return last;
      }
    }
    return last;
  }

  function clampPlayer(p) {
    p.x = clamp(p.x, 6, W - 6);
    p.y = p.side === 0 ? clamp(p.y, 130, 236) : clamp(p.y, 8, 110);
  }

  function movePlayer(p, dx, dy, speed) {
    const len = Math.hypot(dx, dy);
    if (len < 0.5) { p.moving = false; return; }
    const step = Math.min(speed, len);
    p.x += dx / len * step; p.y += dy / len * step;
    p.moving = true; p.walk += step;
    clampPlayer(p);
  }

  function cpuThink(p) {
    const g = game, b = g.ball;
    const home = { x: CX, y: p.side === 1 ? 22 : 218 };
    let tx = p.x, ty = p.y;
    if (g.state === 'rally' && b.live) {
      if (b.hitter !== p.side) {
        if (p.react > 0) p.react--;
        else {
          const t = predict(p.side);
          if (t) { tx = t.x; ty = t.y + 2; }
        }
      } else {
        tx = home.x + (b.x - CX) * 0.3; ty = home.y;
      }
    } else if (g.state === 'point') {
      tx = p.x; ty = p.y;
    }
    let speed = p.ch.speed;
    if (destinedWinnerCpu(p)) speed *= g.mode === 'train' ? 1.8 : 1.6;
    else if (g.mode === 'match') speed *= 0.9;
    movePlayer(p, tx - p.x, ty - p.y, speed);
  }

  // ---------- Point flow ----------
  function endPoint(winner, reason) {
    const g = game;
    if (g.state !== 'rally') return;
    g.state = 'point';
    g.timer = 95;
    const b = g.ball;
    b.live = false;

    if (g.mode === 'warmup') {
      if (g.coffee) return;
      const missed = g.players[1 - winner];
      showMsg('אופס!', `${g.count} מסירות · מתחילים מחדש`);
      sfx.bad();
      if (Math.random() < 0.6) say(1 - winner, lineFor(missed.ch, 'lose'));
      g.count = 0;
      renderHud();
      return;
    }

    if (g.mode === 'train') {
      if (winner === 1) {
        g.strikes++;
        g.timer = 120;
        if (g.strikes >= MAX_STRIKES || g.count >= g.cap) {
          g.trainOver = true;
          if (g.count > g.best) { g.best = g.count; saveBest(g.you.id, g.best); g.newBest = true; }
          showMsg(reason, `נקודות: ${g.count}`);
        } else {
          showMsg(reason, `פסילה ${g.strikes} מתוך ${MAX_STRIKES}`);
        }
        sfx.bad();
        say(1, lineFor(CHARS.tal, 'win', g.you), 2600);
      } else {
        showMsg('נקודה!');
        sfx.good();
      }
      renderHud();
      return;
    }

    g.pts[winner]++;
    let sub = '';
    const [a, o] = [g.pts[winner], g.pts[1 - winner]];
    if (a >= 4 && a - o >= 2) {
      g.games[winner]++;
      g.pts = [0, 0];
      g.server = 1 - g.server;
      if (g.games[winner] >= GAMES_TO_WIN) {
        g.over = true; g.timer = 150;
        sub = won(g.players[winner].ch, 'ניצח') + '!';
      } else sub = 'משחקון ל' + g.players[winner].ch.name;
    }
    showMsg(reason, sub);
    if (g.over) (winner === 0 ? sfx.win : sfx.lose)();
    else (winner === 0 ? sfx.good : sfx.bad)();

    // Trash talk
    const wp = g.players[winner], lp = g.players[1 - winner];
    if (g.over) {
      say(1 - winner, lineFor(lp.ch, 'lose', wp.ch), 2600);
    } else if (Math.random() < 0.4) {
      if (wp.ch.id === 'tal') say(winner, lineFor(wp.ch, 'win', lp.ch));
      else if (lp.ch.id !== 'tal' && Math.random() < 0.6) say(1 - winner, lineFor(lp.ch, 'lose'));
      else if (wp.ch.lines.win) say(winner, lineFor(wp.ch, 'win'));
    } else if (Math.random() < 0.3) {
      const chatty = g.players.filter(p => p.ch.lines.chat);
      if (chatty.length) { const p = pick(chatty); say(p.side, lineFor(p.ch, 'chat', g.players[1 - p.side].ch)); }
    }
    renderHud();
  }

  function lineFor(ch, kind, to) {
    const L = ch.lines;
    if (L.coach) return pick(L.coach.concat(to && to.female ? L.coachF : L.coachM));
    if (kind === 'chat') return pick(L.chat.concat(to && !to.female && L.chatM ? L.chatM : []));
    return pick(L[kind]);
  }

  function afterPoint() {
    const g = game;
    hideMsg();
    if (g.mode === 'train' && g.trainOver) { showTrainResult(); return; }
    if (g.mode === 'warmup' && g.coffee) { showCoffee(); return; }
    if (g.over) { showMatchResult(); return; }
    setupServe();
  }

  function spawnAnimal() {
    const g = game;
    const kinds = Object.keys(ANIMALS).filter(k => !g.animal || k !== g.lastAnimal);
    const kind = pick(kinds);
    const left = Math.random() < 0.5;
    const x = left ? 12 : W - 12, y = rand(70, 190);
    g.animal = { kind, x, y, t: 0, life: 200 };
    g.lastAnimal = kind;
    sfx.good();
    sayAt(ANIMALS[kind].name, `${pick(CHEERS)} ${g.count} נקודות!`, x, y - 34, false, 2600);
  }

  // ---------- Update ----------
  function update() {
    const g = game, b = g.ball;
    const you = g.players[0];
    const aPressed = input.a; input.a = false;

    // Your movement (the server stands still until the serve)
    if (!(g.state === 'serve' && g.serverSide === 0)) {
      if (input.mx || input.my) movePlayer(you, input.mx * 10, input.my * 10, you.ch.speed);
      else if (input.touch) movePlayer(you, input.touch.x - you.x, input.touch.y - you.y, you.ch.speed);
      else you.moving = false;
    } else you.moving = false;
    tipEl.hidden = !(g.state === 'serve' && g.serverSide === 0 && !you.isCpu);

    for (const p of g.players) {
      if (p.isCpu && !(g.state === 'serve' && g.serverSide === p.side)) cpuThink(p);
      else if (p.isCpu) p.moving = false;
    }

    if (g.state === 'serve') {
      const sp = g.players[g.serverSide];
      g.timer++;
      b.x = sp.x + (sp.side === 0 ? 5 : -5);
      b.y = sp.y + (sp.side === 0 ? -1 : 1);
      b.z = 10 + Math.abs(Math.sin(g.timer * 0.07)) * 10;
      if (sp.isCpu ? g.timer > 55 : aPressed) {
        if (sp.isCpu) cpuServe(sp);
        else {
          const h = input.mx > 0.3 ? 8 : input.mx < -0.3 ? -8 : 0;
          hitBall(sp, { serve: true, serveX: (sp.x > CX ? rand(52, 62) : rand(98, 108)) + h, speed: sp.ch.shot * 1.05, h: 0 });
        }
        g.state = 'rally';
      }
    } else {
      const prevY = b.y;
      const ev = stepBall(b);
      if (g.state === 'rally') {
        // Net
        if (b.live && (prevY - NET_Y) * (b.y - NET_Y) < 0 && b.z < NET_H) {
          b.y = prevY; b.vy = -b.vy * 0.15; b.vx *= 0.3;
          sfx.net();
          endPoint(1 - b.hitter, 'רשת!');
        } else if (ev === 'bounce') {
          sfx.bounce();
          if (b.bounces === 0) {
            if (sideOfY(b.y) === b.hitter) endPoint(1 - b.hitter, 'רשת!');
            else if (!inCourt(b.x, b.y)) endPoint(1 - b.hitter, 'אאוט!');
            else {
              b.bounces = 1;
              if (g.mode === 'train' && b.hitter === 0) {
                g.count++; sfx.count(); renderHud();
                if (g.count % 10 === 0) spawnAnimal();
              }
              if (g.mode === 'warmup') {
                g.count++; sfx.count(); renderHud();
                if (g.count % 3 === 0 && g.count < WARMUP_GOAL && Math.random() < 0.6) {
                  const p = pick(g.players);
                  say(p.side, lineFor(p.ch, 'chat', g.players[1 - p.side].ch));
                }
                if (g.count >= WARMUP_GOAL) {
                  // Done: let the ball die and head for iced coffee
                  g.coffee = true;
                  g.state = 'point'; g.timer = 110; b.live = false;
                  showMsg('10!', 'הפסקת קפה קר');
                  sfx.win();
                }
              }
            }
          } else endPoint(b.hitter, 'נקודה!');
        } else if (b.y < -8 || b.y > H + 8 || b.x < -8 || b.x > W + 8) {
          if (b.bounces === 0) endPoint(1 - b.hitter, 'אאוט!');
          else endPoint(b.hitter, 'נקודה!');
        }
        // Hits
        if (g.state === 'rally') {
          for (const p of g.players) {
            if (!canReach(p, b)) continue;
            if (p.isCpu) cpuShot(p); else userShot(p);
            break;
          }
        }
      } else if (g.state === 'point') {
        if (ev === 'bounce' && b.vz > 0.1) sfx.bounce();
        if (--g.timer <= 0) afterPoint();
      }
    }
    for (const p of g.players) if (p.swing > 0) p.swing--;
    if (g.animal && ++g.animal.t > g.animal.life) g.animal = null;
  }

  // ---------- Rendering ----------
  const COL = {
    out: '#2f6b3c', court: '#3f8f4c', line: '#eef6dc', net: '#1d2128', post: '#c9c9c9',
    shadow: 'rgba(0,0,0,0.28)', ball: '#f1f74a', ballDark: '#a9b628',
  };

  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  function drawCourt() {
    rect(0, 0, W, H, COL.out);
    // subtle stripes on the surround for texture
    for (let y = 0; y < H; y += 8) rect(0, y, W, 4, '#2c6639');
    rect(25, 30, 110, 180, COL.court);
    const L = COL.line;
    rect(25, 30, 110, 1, L); rect(25, 209, 110, 1, L); // baselines
    rect(25, 30, 1, 180, L); rect(134, 30, 1, 180, L); // doubles sidelines
    rect(35, 30, 1, 180, L); rect(124, 30, 1, 180, L); // singles sidelines
    rect(35, 70, 90, 1, L); rect(35, 170, 90, 1, L); // service lines
    rect(80, 70, 1, 100, L); // center service line
    rect(80, 30, 1, 3, L); rect(80, 207, 1, 3, L); // center marks
  }

  function drawNet() {
    rect(20, 116, 3, 6, COL.post); rect(137, 116, 3, 6, COL.post);
    rect(22, 118, 116, 1, '#ffffff');
    for (let x = 22; x < 138; x++) {
      rect(x, 119, 1, 1, x % 2 ? COL.net : '#5a5f68');
      rect(x, 120, 1, 1, x % 2 ? '#5a5f68' : COL.net);
    }
    rect(22, 121, 116, 1, 'rgba(0,0,0,0.25)');
  }

  function drawRacket(p, sx, sy) {
    const m = p.side === 0 ? 1 : -1; // racket hand: screen right for back view, screen left for front view
    const hx = sx + 6 + m * 5, hy = sy + 9;
    let x, y, w = 3, h = 4, handle;
    const s = p.swing;
    if (s > 11) { x = hx + m * 2 - 1; y = hy - 3; handle = [hx, hy - 1, 1, 2]; }
    else if (s > 5) { w = 4; h = 3; x = sx + 6 - 2 - m * 1; y = p.side === 0 ? sy - 2 : sy + 15; handle = [hx - m * 2, hy - 1, 1, 2]; }
    else if (s > 0) { x = sx + 6 - m * 7 - 1; y = hy - 4; handle = [sx + 6 - m * 5, hy - 1, 1, 2]; }
    else { x = hx - 1; y = hy - 7; handle = [hx, hy - 3, 1, 3]; }
    rect(handle[0], handle[1], handle[2], handle[3], '#7a4a1e');
    rect(x, y, w, h, '#262626');
    rect(x + 1, y + 1, w - 2, h - 2, '#e8e8e8');
  }

  function drawPlayer(p) {
    const view = p.side === 0 ? 'back' : 'front';
    const leg = p.moving ? [0, 1, 0, 2][Math.floor(p.walk / 3) % 4] : 0;
    const spr = SPRITES[p.ch.id][view][leg];
    const sx = Math.round(p.x - 6), sy = Math.round(p.y - 16);
    ctx.fillStyle = COL.shadow;
    ctx.fillRect(sx + 2, sy + 15, 8, 2);
    if (p.side === 1) { ctx.drawImage(spr, sx, sy); drawRacket(p, sx, sy); }
    else { drawRacket(p, sx, sy); ctx.drawImage(spr, sx, sy); }
  }

  function drawBall(b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    rect(x - 1, y, 3, 1, COL.shadow);
    const by = Math.round(b.y - b.z) - 2;
    rect(x - 1, by, 3, 3, COL.ball);
    rect(x - 1, by, 1, 1, COL.ballDark); rect(x + 1, by + 2, 1, 1, COL.ballDark);
  }

  // Zion, Tal and Lior sitting at a café table with iced coffees
  function drawCoffee(t) {
    rect(0, 0, W, H, '#9fd8f0');
    rect(0, 132, W, H - 132, '#3f8f4c');
    for (let y = 136; y < H; y += 8) rect(0, y, W, 4, '#3a8546');
    ctx.save();
    ctx.translate(0, -18); // keep the picture above the text panel
    // sun
    rect(126, 30, 14, 14, '#ffe066'); rect(124, 33, 18, 8, '#ffe066'); rect(129, 28, 8, 18, '#ffe066');
    // court fence in the distance
    for (let x = 0; x < W; x += 6) rect(x, 120, 1, 30, '#5b6b5b');
    rect(0, 120, W, 1, '#5b6b5b'); rect(0, 135, W, 1, '#5b6b5b');
    // parasol
    rect(79, 48, 2, 90, '#d9d9d9');
    for (let i = 0; i < 12; i++) {
      const y = 34 + i, half = 14 + i * 4;
      for (let x = CX - half; x < CX + half; x++) {
        rect(x, y, 1, 1, Math.floor((x - CX + 200) / 12) % 2 ? '#e84a4a' : '#ffffff');
      }
    }
    rect(30, 46, 100, 2, '#b83232');
    const seats = [['zion', 38], ['tal', 80], ['lior', 122]];
    ctx.imageSmoothingEnabled = false;
    seats.forEach(([id, x], i) => {
      const bob = Math.sin(t / 300 + i * 2.1) > 0.6 ? -1 : 0; // laughing / chatting
      rect(x - 12, 98, 24, 32, '#8a5a2b'); // chair back
      rect(x - 10, 100, 20, 28, '#a46d36');
      ctx.drawImage(SPRITES[id].front[0], 0, 0, 12, 12, x - 12, 106 + bob, 24, 24);
    });
    // table
    rect(14, 128, 132, 6, '#c98b4b'); rect(14, 134, 132, 2, '#8a5a2b');
    rect(24, 136, 4, 30, '#8a5a2b'); rect(132, 136, 4, 30, '#8a5a2b');
    // iced coffees
    seats.forEach(([, x], i) => {
      const cx = x + 8;
      rect(cx, 114, 8, 14, '#d8eef8');
      rect(cx + 1, 118, 6, 9, '#8a5a2b');
      rect(cx + 1, 118, 6, 2, '#c49a6c');
      const ice = Math.sin(t / 400 + i) > 0 ? 0 : 1;
      rect(cx + 1, 119 + ice, 2, 2, '#ffffff'); rect(cx + 4, 121 - ice, 2, 2, '#f0faff');
      rect(cx + 5, 106, 1, 9, '#ff6fb1'); rect(cx + 5, 106, 3, 1, '#ff6fb1');
    });
    ctx.restore();
  }

  function drawAnimal(a) {
    const A = ANIMALS[a.kind];
    const cheering = Math.floor(a.t / 10) % 2 === 1;
    const hop = Math.round(Math.abs(Math.sin(a.t / 10 * Math.PI / 2)) * (a.kind === 'kangaroo' ? 8 : 4));
    const pop = a.t < 12 ? Math.round((12 - a.t) * 2.4) : 0; // springs up out of the ground
    const x = Math.round(a.x - 12), y = Math.round(a.y - 28 - hop + pop); // drawn at 2x
    rect(x + 4, Math.round(a.y) - 1, 16, 2, COL.shadow);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, Math.round(a.y) + 1); ctx.clip();
    if (a.x > CX) { ctx.translate(x * 2 + 24, 0); ctx.scale(-1, 1); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(A.frames[cheering ? 1 : 0], x, y, 24, 28);
    ctx.restore();
    // confetti
    const colors = ['#ff6fb1', '#f1f74a', '#ffffff', '#5ad1ff'];
    for (let i = 0; i < 8; i++) {
      const ct = (a.t * 0.6 + i * 13) % 40;
      rect(Math.round(a.x - 12 + ((i * 7) % 25)), Math.round(a.y - 44 + ct), 2, 2, colors[i % 4]);
    }
  }

  function render() {
    if (game && game.mode === 'warmup' && game.coffeeScene) { drawCoffee(performance.now()); return; }
    drawCourt();
    if (!game) { drawNet(); return; }
    if (game.animal) drawAnimal(game.animal);
    const items = game.players.map(p => ({ y: p.y, draw: () => drawPlayer(p) }));
    const b = game.ball;
    items.push({ y: b.y + 0.1, draw: () => drawBall(b) });
    items.sort((u, v) => u.y - v.y);
    let netDrawn = false;
    for (const it of items) {
      if (!netDrawn && it.y >= NET_Y) { drawNet(); netDrawn = true; }
      it.draw();
    }
    if (!netDrawn) drawNet();
  }

  // ---------- HUD / messages ----------
  function renderHud() {
    const g = game;
    if (!g) { hud.innerHTML = '<div class="center">טניס עם הקפטנית</div>'; return; }
    if (g.mode === 'warmup') {
      hud.innerHTML = `<div class="row"><span class="nm">חימום: ציון וליאור</span></div>
        <div class="row"><span class="nm">מסירות: ${g.count} / ${WARMUP_GOAL}</span></div>`;
      return;
    }
    if (g.mode === 'train') {
      hud.innerHTML = `<div class="row"><span class="nm">אימון: ${g.you.name} מול טל</span></div>
        <div class="row"><span class="nm">נקודות: ${g.count} / ${g.cap}</span>
        <span class="gm">פסילות: ${'✖'.repeat(g.strikes)}${'○'.repeat(MAX_STRIKES - g.strikes)} · שיא: ${g.best}</span></div>`;
      return;
    }
    const [a, o] = g.pts;
    const lbl = i => {
      const me = g.pts[i], th = g.pts[1 - i];
      if (a >= 3 && o >= 3) return me > th ? 'AD' : '40';
      return POINT_LABELS[me];
    };
    hud.innerHTML = [1, 0].map(i => `<div class="row${g.state === 'serve' && g.serverSide === i ? ' serving' : ''}">
      <span class="nm">${g.players[i].ch.name}${i === 0 ? (g.you.female ? ' (את)' : ' (אתה)') : ''}</span>
      <span class="gm">משחקונים ${g.games[i]}/${GAMES_TO_WIN}</span><span class="pt">${lbl(i)}</span></div>`).join('');
  }

  let msgTimer = 0;
  function showMsg(text, sub) {
    msgEl.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    msgEl.hidden = false;
    clearTimeout(msgTimer);
  }
  function hideMsg() { msgEl.hidden = true; }

  let bubbleTimer = 0;
  function say(side, text, ms = 2200) {
    const p = game.players[side];
    if (p.side === 1) sayAt(p.ch.name, text, p.x, p.y + 3, true, ms);
    else sayAt(p.ch.name, text, p.x, p.y - 20, false, ms);
  }
  function sayAt(name, text, x, y, below, ms = 2200) {
    bubble.innerHTML = `<b>${name}:</b> ${text}`;
    bubble.style.left = clamp(x / W * 100, 26, 74) + '%';
    bubble.style.top = (y / H * 100) + '%';
    bubble.className = below ? 'below' : 'above';
    bubble.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, ms);
  }

  // ---------- Menus ----------
  function showOverlay(html, cls = '') {
    overlay.innerHTML = `<div class="menu">${html}</div>`;
    overlay.className = 'show ' + cls;
    const first = overlay.querySelector('button');
    if (first && matchMedia('(hover: hover)').matches) first.focus({ preventScroll: true });
  }
  function hideOverlay() { overlay.className = ''; overlay.innerHTML = ''; }
  function moveMenuFocus(dir) {
    const btns = [...overlay.querySelectorAll('button')];
    if (!btns.length) return;
    const i = btns.indexOf(document.activeElement);
    btns[(i + dir + btns.length) % btns.length].focus();
  }

  const card = (id, act) => `<button class="card" data-act="${act}" data-id="${id}">
      <img src="${portrait(id)}" alt=""><span>${CHARS[id].name}<small>${CHARS[id].desc}</small></span></button>`;

  function showTitle() {
    game = null;
    bubble.hidden = true; hideMsg();
    renderHud();
    showOverlay(`<h1>טניס עם<br>הקפטנית</h1><div class="sub">משחק יחידים</div>
      <button data-act="warmup">חימום: ציון וליאור</button>
      <button data-act="train">אימון מול טל</button>
      <button data-act="match">משחק אמיתי</button>
      <p class="small">גוררים את האצבע על המגרש והשחקן רץ אליה.<br>המכה אוטומטית כשהכדור מגיע. נגיעה במסך = הגשה.<br>במחשב: גרירה עם העכבר או החצים, רווח להגשה.</p>`);
  }

  function showWarmupPick() {
    showOverlay(`<h2>חימום</h2><p>מתמסרים עד ${WARMUP_GOAL} בלי לפספס,<br>ואז יושבים לקפה קר עם טל.</p><p>את מי משחקים?</p>
      ${card('zion', 'warm-go')}${card('lior', 'warm-go')}
      <button class="ghost" data-act="title">חזרה</button>`);
  }

  function showCoffee() {
    const g = game;
    g.coffeeScene = true;
    bubble.hidden = true;
    renderHud();
    hud.innerHTML = `<div class="center">${WARMUP_GOAL} מסירות! הפסקת קפה קר ☕</div>`;
    showOverlay(`<div class="quote"><b>ציון:</b> חייבת לי קפה</div>
      <div class="quote"><b>ליאור:</b> ${lineFor(CHARS.lior, 'chat', CHARS.zion)}</div>
      <div class="quote"><b>טל:</b> ${pick(['לא יכולה אני בלימודים', 'צריכה לבדוק אם יש מגרש', 'תמרים מעולים'])}</div>
      <div class="btns"><button data-act="again">עוד חימום</button>
      <button class="ghost" data-act="title">תפריט</button></div>`, 'scene');
  }

  function showTrainPick() {
    showOverlay(`<h2>אימון מול טל</h2><p>מי מתאמן/ת היום?</p>
      ${card('zion', 'train-go')}${card('lior', 'train-go')}
      <p class="small">כל כדור שנוחת אצל טל = נקודה. ${MAX_STRIKES} פסילות והאימון נגמר.</p>
      <button class="ghost" data-act="title">חזרה</button>`);
  }

  function showMatchPick() {
    showOverlay(`<h2>משחק אמיתי</h2><p>בחר/י שחקן/ית:</p>
      ${card('tal', 'match-you')}${card('zion', 'match-you')}${card('lior', 'match-you')}
      <p class="small">עד ${GAMES_TO_WIN} משחקונים</p>
      <button class="ghost" data-act="title">חזרה</button>`);
  }

  function showOppPick(youId) {
    const others = Object.keys(CHARS).filter(id => id !== youId);
    showOverlay(`<h2>${CHARS[youId].name} נגד...</h2>
      ${others.map(id => card(id, 'match-go')).join('')}
      <button class="ghost" data-act="match">חזרה</button>`);
    overlay.dataset.you = youId;
  }

  function showTrainResult() {
    const g = game;
    const capHit = g.count >= g.cap;
    showOverlay(`<h2>סוף האימון</h2>
      <div class="big">${g.count}</div>
      <p>${capHit ? 'זה המקסימום שלך מול טל!' : g.newBest ? 'שיא חדש!' : `השיא שלך: ${g.best}`}</p>
      <div class="quote"><b>טל:</b> ${lineFor(CHARS.tal, 'win', g.you)}</div>
      <button data-act="again">עוד אימון</button>
      <button class="ghost" data-act="title">תפריט</button>`);
  }

  function showMatchResult() {
    const g = game;
    const wSide = g.games[0] > g.games[1] ? 0 : 1;
    const wp = g.players[wSide].ch, lp = g.players[1 - wSide].ch;
    showOverlay(`<h2>${wp.name} ${won(wp, 'ניצח')}!</h2>
      <div class="big">${g.games[wSide]}–${g.games[1 - wSide]}</div>
      <div class="quote"><b>${wp.name}:</b> ${lineFor(wp, 'win', lp)}</div>
      <div class="quote"><b>${lp.name}:</b> ${lineFor(lp, 'lose', wp)}</div>
      <button data-act="again">משחק חוזר</button>
      <button class="ghost" data-act="title">תפריט</button>`);
  }

  function pause() {
    if (!game || overlay.classList.contains('show')) return;
    game.paused = true;
    showOverlay(`<h2>הפסקה</h2>
      <button data-act="resume">המשך</button>
      <button class="ghost" data-act="title">יציאה לתפריט</button>`);
  }
  function resume() { if (game) { game.paused = false; hideOverlay(); } }

  overlay.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    ensureAudio();
    sfx.count();
    const act = btn.dataset.act, id = btn.dataset.id;
    switch (act) {
      case 'title': showTitle(); break;
      case 'train': showTrainPick(); break;
      case 'warmup': showWarmupPick(); break;
      case 'warm-go': startGame('warmup', id, id === 'zion' ? 'lior' : 'zion'); break;
      case 'match': showMatchPick(); break;
      case 'train-go': startGame('train', id, 'tal'); break;
      case 'match-you': showOppPick(id); break;
      case 'match-go': startGame('match', overlay.dataset.you, id); break;
      case 'resume': resume(); break;
      case 'again': startGame(game.mode, game.you.id, game.opp.id); break;
    }
  });

  // ---------- Loop ----------
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      if (game && !game.paused && !overlay.classList.contains('show')) update();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  showTitle();
  requestAnimationFrame(frame);

  // Hook for automated testing
  window.__tennis = {
    get game() { return game; },
    startGame, update,
    autopilot() { if (game) game.players[0].isCpu = true; },
  };
})();
