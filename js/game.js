/* Poäng, achievements och världar att bygga. Allt sparas per profil på enheten. */
(function () {
  "use strict";
  var P = window.P;
  var G = (P.game = {});

  /* ================= Regler ================= */
  G.RULES = {
    hittaRight: 100,
    streakStep: 20,     // extra per rätt i rad
    streakMax: 100,
    hittaWrong: -100,
    hittaRushed: -250,  // fel och snabbt
    rushedMs: 4000,     // "snabbt" i Hitta på kartan
    itemRight: 50,      // Sätt ut numren / Skriv namnen, per plats
    itemWrong: -50,
    itemRushedMsPerItem: 3000,
    minRound: 5,        // minsta omgång för achievements
    worldPrice: 2500,
  };

  /* Nivåer för achievements som kan fås flera gånger */
  G.TIERS = [
    { n: "Lera", at: 1, bonus: 100, c1: "#e0957a", c2: "#9c4a2f" },
    { n: "Trä", at: 3, bonus: 200, c1: "#ecc98e", c2: "#8a6230" },
    { n: "Sten", at: 10, bonus: 300, c1: "#b8bcc2", c2: "#6c7178" },
    { n: "Brons", at: 25, bonus: 500, c1: "#e0a060", c2: "#8c5420" },
    { n: "Silver", at: 50, bonus: 750, c1: "#f2f4f7", c2: "#9aa1ab" },
    { n: "Guld", at: 100, bonus: 1000, c1: "#ffe27a", c2: "#c9930a" },
    { n: "Diamant", at: 250, bonus: 2000, c1: "#d9f6ff", c2: "#46b8e0" },
  ];

  G.ACH = [
    { id: "felfri", icon: "✨", name: "Felfri", desc: "En hel omgång utan fel (minst 5 frågor)" },
    { id: "svit", icon: "🔥", name: "Het svit", desc: "10 rätt i rad i Hitta på kartan" },
    { id: "prickskytt", icon: "🎯", name: "Prickskytt", desc: "Mindre än 10 km från en stad, ett berg eller en flod" },
    { id: "comeback", icon: "💪", name: "Comeback", desc: "Rätt på något du behövde träna mer på" },
    { id: "flitig", icon: "📚", name: "Flitig", desc: "Gör klart en omgång (minst 5 frågor)" },
    { id: "dagar", icon: "📅", name: "Varje dag", desc: "Öva en ny dag" },
    { id: "mastare", icon: "🧠", name: "Mästare", desc: "Kan en hel lista (allt grönt i statistiken)" },
    { id: "samlare", icon: "🛍️", name: "Samlare", desc: "Köp saker till dina världar" },
    { id: "forsta", icon: "🌱", name: "Första steget", desc: "Gör din första omgång", once: true },
  ];

  /* ================= Världar och saker ================= */
  var PRICES = [300, 300, 400, 500, 500, 600, 800, 800, 1000, 1200, 1500, 2000, 2500, 3000];
  var RAW = [
    ["anime", "Anime", "🌸", "#ffe3f1", "#cde8a8",
      "🌸 Körsbärsblom|🦊 Räv|🐱 Katt|🍙 Riskaka|🍜 Ramen|🏮 Lykta|🎏 Karpflaggor|🌙 Måne|⚡ Blixt|🗡️ Svärd|🎎 Dockor|⛩️ Port|🐉 Drake|🏯 Slott"],
    ["bilar", "Bilar", "🏎️", "#dff1ff", "#9aa0a6",
      "🚦 Trafikljus|🏁 Målflagga|⛽ Bensinpump|🚗 Bil|🚕 Taxi|🚙 Jeep|🛻 Pickup|🚌 Buss|🚓 Polisbil|🚑 Ambulans|🚚 Lastbil|🚒 Brandbil|🏍️ Motorcykel|🏎️ Racerbil"],
    ["flyg", "Flygplan", "✈️", "#cfe9ff", "#b7d98b",
      "☁️ Moln|🌤️ Sol|🎈 Ballong|🪁 Drake|🧳 Resväska|🌈 Regnbåge|🪂 Fallskärm|🛩️ Propellerplan|🚁 Helikopter|✈️ Flygplan|🛫 Flygplan som lyfter|🛰️ Satellit|🚀 Raket|🛸 UFO"],
    ["smink", "Smink", "💄", "#f3e6ff", "#f7c6dc",
      "🎀 Rosett|💋 Pussmun|🧴 Kräm|💅 Nagellack|💄 Läppstift|🌹 Ros|🪞 Spegel|👛 Väska|👠 Klackskor|🧖 Spa|✨ Glitter|💍 Ring|💎 Diamant|👑 Krona"],
    ["mat", "Mat", "🍕", "#fff1dc", "#e8c79a",
      "🥐 Croissant|🥗 Sallad|🍳 Stekpanna|🌭 Varmkorv|🥞 Pannkakor|🧇 Våffla|🍗 Kycklingklubba|🌮 Taco|🍝 Spaghetti|🍱 Matlåda|🥘 Gryta|🍣 Sushi|🍔 Hamburgare|🍕 Pizza"],
    ["dryck", "Dryck", "🧋", "#dcf7f5", "#a8dcd2",
      "💧 Vatten|🧊 Isbit|🍋 Citron|🍊 Apelsin|🥛 Mjölk|🍵 Te|☕ Kakao|🧃 Juice|🥥 Kokos|🫖 Tekanna|🥤 Läsk|🍹 Tropisk drink|🍉 Melonsaft|🧋 Bubbelte"],
    ["godis", "Godis", "🍭", "#ffe4ef", "#f9b9d2",
      "🍬 Karamell|🍯 Honung|🍪 Kaka|🍡 Spettgodis|🍫 Choklad|🍩 Munk|🍮 Pudding|🧁 Muffin|🍦 Glass|🍨 Glasskål|🍧 Isglass|🍰 Tårtbit|🍭 Klubba|🎂 Tårta"],
    ["snacks", "Snacks", "🍿", "#fff6d6", "#e2c27a",
      "🥕 Morot|🥜 Jordnötter|🌰 Nötter|🥔 Potatis|🍇 Vindruvor|🍌 Banan|🍓 Jordgubbe|🥨 Kringla|🧀 Ost|🍘 Riskex|🥯 Bagel|🍉 Vattenmelon|🍟 Pommes|🍿 Popcorn"],
    ["spel", "Spel", "🎮", "#e7e1ff", "#5b4b8a",
      "🎲 Tärning|🃏 Spelkort|🪀 Jojo|🧩 Pussel|♟️ Schack|⚽ Fotboll|🏀 Basket|🎯 Piltavla|🎳 Bowling|🛹 Skateboard|👾 Rymdmonster|🕹️ Joystick|🎮 Handkontroll|🏆 Pokal"],
    ["memes", "Memes", "🗿", "#fff9c4", "#c7e59a",
      "👀 Ögon|💯 Hundra|🔥 Eld|😂 Skrattgråt|🦆 Anka|🐸 Groda|🐶 Hund|🥶 Iskall|🫠 Smälter|😎 Cool|🤡 Clown|💀 Dödskalle|🤯 Mind blown|🗿 Stenhuvud"],
  ];

  function slug(s) {
    return P.normalize(s).replace(/å|ä/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  G.WORLDS = [];
  G.ITEMS = {};
  RAW.forEach(function (w) {
    var world = { id: w[0], name: w[1], icon: w[2], sky: w[3], ground: w[4], items: [] };
    w[5].split("|").forEach(function (s, i) {
      var sp = s.indexOf(" ");
      var it = { id: w[0] + "-" + slug(s.slice(sp + 1)), e: s.slice(0, sp), name: s.slice(sp + 1), price: PRICES[i] || 3000, world: w[0], kind: "emoji" };
      world.items.push(it);
      G.ITEMS[it.id] = it;
    });
    G.WORLDS.push(world);
  });

  G.BLOCKS = [
    ["rod", "Röd", "#e2483d"], ["orange", "Orange", "#f28c28"], ["gul", "Gul", "#f6cf3c"], ["gron", "Grön", "#4caf50"],
    ["bla", "Blå", "#2f7de1"], ["lila", "Lila", "#8e5bd6"], ["rosa", "Rosa", "#f27fb2"], ["vit", "Vit", "#f4f4f4"],
    ["gra", "Grå", "#9aa0a6"], ["svart", "Svart", "#33363b"], ["brun", "Brun", "#8b5a2b"], ["glas", "Glas", "rgba(150,210,255,.55)"],
  ].map(function (b) {
    var it = { id: "kloss-" + b[0], name: b[1] + " kloss", color: b[2], price: 50, kind: "block" };
    G.ITEMS[it.id] = it;
    return it;
  });
  G.ITEMS["kloss-guld"] = { id: "kloss-guld", name: "Guldkloss", color: "#f5c542", price: 1000, kind: "block", shiny: true };
  G.BLOCKS.push(G.ITEMS["kloss-guld"]);

  G.TIERS.forEach(function (t, i) {
    G.ITEMS["pokal-" + i] = { id: "pokal-" + i, name: "Medalj i " + t.n.toLowerCase(), kind: "medal", tier: i, price: 0 };
  });

  /* Exklusiva saker – finns inte i butiken, bara som belöning från achievements */
  G.SPECIAL = "🦄 Enhörning|🦖 Dinosaurie|🐳 Val|🌋 Vulkan|🪐 Planet|🏰 Borg|🎡 Pariserhjul|🎢 Berg-och-dalbana|🦚 Påfågel|🧞 Ande|🐲 Drakhuvud|🌠 Stjärnfall"
    .split("|").map(function (s) {
      var sp = s.indexOf(" ");
      var it = { id: "special-" + slug(s.slice(sp + 1)), e: s.slice(0, sp), name: s.slice(sp + 1), price: 0, world: "special", kind: "emoji", special: true };
      G.ITEMS[it.id] = it;
      return it;
    });

  /* Vad varje nivå ger utöver bonuspoäng och medalj */
  G.TIER_REWARDS = [
    { blocks: 5 },                        // Lera
    { blocks: 10 },                       // Trä
    { blocks: 10, item: true },           // Sten: en slumpad sak
    { blocks: 15, item: true },           // Brons
    { blocks: 20, item: true },           // Silver
    { gold: 3, special: true },           // Guld: guldklossar + exklusiv sak
    { gold: 10, special: true },          // Diamant
  ];

  /* ================= Lagring ================= */
  var KEY = "plugga.game.v1";
  function pid() { var s = P.store.get(); return s.current || "anon"; }
  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function writeAll(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {}
  }
  G.state = function () {
    var a = readAll();
    var g = a[pid()];
    if (!g) g = { points: 0, streak: 0, ach: {}, lvl: {}, inv: {}, worlds: {}, mastered: {}, lastDay: null };
    return g;
  };
  G.save = function (g) {
    var a = readAll();
    a[pid()] = g;
    writeAll(a);
    G.renderBadge();
  };

  /* ================= Achievements ================= */
  function tierFor(count) {
    var t = -1;
    for (var i = 0; i < G.TIERS.length; i++) if (count >= G.TIERS[i].at) t = i;
    return t;
  }
  function achById(id) { for (var i = 0; i < G.ACH.length; i++) if (G.ACH[i].id === id) return G.ACH[i]; return null; }

  /** Ökar en achievement och ger bonus + medalj när en ny nivå nås. Returnerar händelser för visning. */
  function bump(g, id, n, events) {
    var a = achById(id);
    var before = g.ach[id] || 0;
    if (a.once && before >= 1) return;
    var after = a.once ? 1 : before + (n || 1);
    g.ach[id] = after;
    if (a.once) {
      if (!before) {
        g.points += 100;
        events.push({ type: "ach", ach: a, tier: null, bonus: 100, rewards: giveRewards(g, { blocks: 5 }) });
      }
      return;
    }
    var t0 = tierFor(before), t1 = tierFor(after);
    for (var t = t0 + 1; t <= t1; t++) {
      g.points += G.TIERS[t].bonus;
      var rewards = [{ id: "pokal-" + t, n: 1 }].concat(giveRewards(g, G.TIER_REWARDS[t]));
      g.inv["pokal-" + t] = (g.inv["pokal-" + t] || 0) + 1;
      events.push({ type: "ach", ach: a, tier: t, bonus: G.TIERS[t].bonus, rewards: rewards });
    }
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  /** Delar ut klossar/saker enligt en belöning och returnerar [{id, n}] */
  function giveRewards(g, r) {
    var out = {};
    function add(id, n) { g.inv[id] = (g.inv[id] || 0) + n; out[id] = (out[id] || 0) + n; }
    var colors = G.BLOCKS.filter(function (b) { return !b.shiny; });
    for (var i = 0; i < (r.blocks || 0); i++) add(pick(colors).id, 1);
    if (r.gold) add("kloss-guld", r.gold);
    if (r.item) {
      // helst från en värld man har låst upp
      var open = G.WORLDS.filter(function (w) { return g.worlds[w.id]; });
      var pool = [];
      (open.length ? open : G.WORLDS).forEach(function (w) { pool = pool.concat(w.items); });
      add(pick(pool).id, 1);
    }
    if (r.special) {
      var notOwned = G.SPECIAL.filter(function (it) { return !g.inv[it.id]; });
      add(pick(notOwned.length ? notOwned : G.SPECIAL).id, 1);
    }
    return Object.keys(out).map(function (id) { return { id: id, n: out[id] }; });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  /* ================= Poäng från övningarna ================= */
  /** Ett svar i Hitta på kartan. */
  G.onHitta = function (o) {
    var g = G.state(), R = G.RULES, events = [];
    var delta, rushed = false, bonus = 0;
    if (o.ok) {
      bonus = Math.min(R.streakMax, g.streak * R.streakStep);
      delta = R.hittaRight + bonus;
      g.streak++;
      if (g.streak % 10 === 0) bump(g, "svit", 1, events);
      if (o.pinpoint) bump(g, "prickskytt", 1, events);
      if (o.wasWeak) bump(g, "comeback", 1, events);
    } else {
      rushed = o.ms < R.rushedMs;
      delta = rushed ? R.hittaRushed : R.hittaWrong;
      g.streak = 0;
    }
    g.points += delta;
    G.save(g);
    return { delta: delta, rushed: rushed, bonus: bonus, streak: g.streak, events: events };
  };

  /** Rättning i Sätt ut numren / Skriv namnen. */
  G.onCheck = function (o) {
    var g = G.state(), R = G.RULES, events = [];
    var wrong = o.total - o.correct;
    var rushed = wrong > 0 && o.ms < R.itemRushedMsPerItem * o.total;
    var delta = o.correct * R.itemRight + wrong * R.itemWrong * (rushed ? 2 : 1);
    g.points += delta;
    if (o.comebacks) bump(g, "comeback", o.comebacks, events);
    G.save(g);
    return { delta: delta, rushed: rushed, events: events };
  };

  /** När en omgång är klar (alla övningar). */
  G.onRound = function (o) {
    var g = G.state(), events = [];
    bump(g, "forsta", 1, events);
    if (o.total >= G.RULES.minRound) {
      bump(g, "flitig", 1, events);
      if (o.wrong === 0) bump(g, "felfri", 1, events);
    }
    var d = today();
    if (g.lastDay !== d) { g.lastDay = d; bump(g, "dagar", 1, events); }
    if (o.mastered && !g.mastered[o.listId]) { g.mastered[o.listId] = true; bump(g, "mastare", 1, events); }
    G.save(g);
    return { events: events };
  };

  /* ================= Köp och bygg ================= */
  G.worldUnlocked = function (g, wid) { return !!g.worlds[wid]; };
  G.unlockWorld = function (wid) {
    var g = G.state();
    if (g.worlds[wid]) return true;
    var free = Object.keys(g.worlds).length === 0;
    if (!free && g.points < G.RULES.worldPrice) return false;
    if (!free) g.points -= G.RULES.worldPrice;
    g.worlds[wid] = { grid: {} };
    G.save(g);
    return true;
  };
  G.buy = function (itemId, qty) {
    var g = G.state(), it = G.ITEMS[itemId];
    qty = qty || 1;
    var cost = it.price * qty;
    if (!it || g.points < cost) return null;
    g.points -= cost;
    g.inv[itemId] = (g.inv[itemId] || 0) + qty;
    var events = [];
    bump(g, "samlare", 1, events);
    G.save(g);
    return events;
  };
  G.place = function (wid, cell, itemId) {
    var g = G.state(), w = g.worlds[wid];
    if (!w || !(g.inv[itemId] > 0)) return false;
    var old = w.grid[cell];
    if (old === itemId) return false;
    if (old) g.inv[old] = (g.inv[old] || 0) + 1;
    w.grid[cell] = itemId;
    g.inv[itemId]--;
    G.save(g);
    return true;
  };
  G.remove = function (wid, cell) {
    var g = G.state(), w = g.worlds[wid];
    if (!w || !w.grid[cell]) return false;
    var old = w.grid[cell];
    g.inv[old] = (g.inv[old] || 0) + 1;
    delete w.grid[cell];
    G.save(g);
    return true;
  };

  /* ================= Visning ================= */
  G.fmt = function (n) {
    var s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (n < 0 ? "−" : "") + s;
  };
  G.fmtDelta = function (n) { return (n >= 0 ? "+" : "") + G.fmt(n); };

  G.renderBadge = function () {
    var el = document.getElementById("points-btn");
    if (!el) return;
    var p = G.state().points;
    el.innerHTML = "⭐ " + G.fmt(p);
    el.classList.toggle("neg", p < 0);
  };

  G.medalHTML = function (tier, icon, size) {
    size = size || 44;
    var t = tier == null ? { c1: "#e9f7e3", c2: "#4caf50" } : G.TIERS[tier];
    return '<span class="medal" style="width:' + size + "px;height:" + size + "px;font-size:" + Math.round(size * 0.5) +
      "px;background:radial-gradient(circle at 35% 30%," + t.c1 + "," + t.c2 + ')">' + (icon || "★") + "</span>";
  };

  /* Toasts (små meddelanden längst ner) */
  var toastBox = null;
  G.toast = function (html, cls) {
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.className = "toasts";
      document.body.appendChild(toastBox);
    }
    var t = document.createElement("div");
    t.className = "toast " + (cls || "");
    t.innerHTML = html;
    toastBox.appendChild(t);
    while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
    setTimeout(function () { t.classList.add("out"); }, 3500);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  };
  G.showEvents = function (events) {
    (events || []).forEach(function (ev, i) {
      setTimeout(function () {
        var a = ev.ach;
        var title = ev.tier == null ? a.name : a.name + " – " + G.TIERS[ev.tier].n;
        var gifts = (ev.rewards || []).map(function (r) {
          return '<span class="gift">' + cellHTML(G.ITEMS[r.id], 22) + (r.n > 1 ? "×" + r.n : "") + "</span>";
        }).join("");
        G.toast(G.medalHTML(ev.tier, a.icon, 40) + "<div><b>" + P.esc(title) + "!</b><br><small>" +
          P.esc(a.desc) + "</small><br><small><b>+" + G.fmt(ev.bonus) + " poäng</b></small>" +
          (gifts ? '<div class="gifts">' + gifts + "</div>" : "") + "</div>", "ach");
      }, i * 700);
    });
  };

  function cellHTML(it, size) {
    if (!it) return "";
    if (it.kind === "block") {
      return '<span class="brick' + (it.shiny ? " shiny" : "") + '" style="background-color:' + it.color + '"></span>';
    }
    if (it.kind === "medal") return G.medalHTML(it.tier, "★", Math.round(size * 0.86));
    return '<span class="emo" style="font-size:' + Math.round(size * 0.78) + 'px">' + it.e + "</span>";
  }
  G.cellHTML = cellHTML;

  var COLS = 16, ROWS = 10;
  function sceneHTML(world, grid, size, extraCls) {
    var html = '<div class="scene ' + (extraCls || "") + '" style="width:' + size * COLS + "px;height:" + size * ROWS +
      "px;--cell:" + size + "px;background:linear-gradient(" + world.sky + " 0%," + world.sky + " 80%," + world.ground + ' 80%)">';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var id = grid[r + "," + c];
        html += '<div class="cell" data-cell="' + r + "," + c + '" style="left:' + c * size + "px;top:" + r * size + "px;width:" +
          size + "px;height:" + size + 'px">' + (id ? cellHTML(G.ITEMS[id], size) : "") + "</div>";
      }
    }
    return html + "</div>";
  }

  function worldById(id) { for (var i = 0; i < G.WORLDS.length; i++) if (G.WORLDS[i].id === id) return G.WORLDS[i]; return null; }

  /* ---------- Sida: Mina världar ---------- */
  G.viewWorlds = function (ctx) {
    ctx.setCrumb([{ t: "Start", href: "#/" }, { t: "Mina världar" }]);
    var g = G.state();
    var unlocked = Object.keys(g.worlds).length;
    var html = '<h1 class="page-title">Mina världar</h1>' +
      '<div class="card points-card"><div class="big-points' + (g.points < 0 ? " neg" : "") + '">⭐ ' + G.fmt(g.points) + ' poäng</div>' +
      '<p class="small muted">Rätt svar ger poäng, fel svar tar poäng och snabba fel kostar mest. Ta det lugnt och tänk efter! ' +
      'Köp klossar och saker och bygg dina världar. Det du har köpt kan du aldrig förlora.</p>' +
      '<div class="row wrap"><a class="btn" href="#/prestationer">🏆 Prestationer</a></div></div>';
    if (!unlocked) html += '<p class="instr">Välj din första värld. Den är gratis!</p>';
    html += '<div class="cards worlds">';
    G.WORLDS.forEach(function (w) {
      var open = !!g.worlds[w.id];
      html += '<div class="card world-card' + (open ? "" : " locked") + '">' +
        '<div class="thumb">' + sceneHTML(w, open ? g.worlds[w.id].grid : {}, 14, "mini") + "</div>" +
        "<h3>" + w.icon + " " + P.esc(w.name) + "</h3>";
      if (open) html += '<a class="btn primary" href="#/varld/' + w.id + '">Bygg</a>';
      else if (!unlocked) html += '<button class="btn primary" data-unlock="' + w.id + '">Välj (gratis)</button>';
      else html += '<button class="btn" data-unlock="' + w.id + '"' + (g.points < G.RULES.worldPrice ? " disabled" : "") +
        ">🔒 Lås upp för " + G.fmt(G.RULES.worldPrice) + "</button>";
      html += "</div>";
    });
    html += "</div>";
    ctx.main.innerHTML = html;
    Array.prototype.forEach.call(ctx.main.querySelectorAll("[data-unlock]"), function (b) {
      b.onclick = function () {
        var wid = b.getAttribute("data-unlock");
        var w = worldById(wid);
        var free = Object.keys(G.state().worlds).length === 0;
        if (!free && !confirm("Lås upp " + w.name + " för " + G.fmt(G.RULES.worldPrice) + " poäng?")) return;
        if (G.unlockWorld(wid)) location.hash = "#/varld/" + wid;
      };
    });
  };

  /* ---------- Sida: bygg en värld ---------- */
  G.viewWorld = function (ctx, wid) {
    var w = worldById(wid);
    var g = G.state();
    if (!w || !g.worlds[wid]) { location.hash = "#/varldar"; return; }
    ctx.setCrumb([{ t: "Start", href: "#/" }, { t: "Mina världar", href: "#/varldar" }, { t: w.name }]);
    document.body.classList.add("playing");
    var tool = null, tab = "bygg";
    ctx.main.innerHTML = '<div class="build"><div class="build-stage" id="stage"></div><aside class="play-panel build-panel" id="bpanel"></aside></div>';
    var stage = document.getElementById("stage");
    var panel = document.getElementById("bpanel");

    function cellSize() {
      var wdt = stage.clientWidth - 24, hgt = stage.clientHeight - 24;
      return Math.max(20, Math.min(64, Math.floor(wdt / COLS), hgt > 100 ? Math.floor(hgt / ROWS) : 64));
    }

    function drawScene() {
      g = G.state();
      stage.innerHTML = sceneHTML(w, g.worlds[wid].grid, cellSize(), "big");
      bindScene();
    }

    function owned(id) { return g.inv[id] || 0; }

    function drawPanel() {
      g = G.state();
      var html = '<div class="tabs"><button class="tab' + (tab === "bygg" ? " on" : "") + '" data-tab="bygg">🧱 Bygg</button>' +
        '<button class="tab' + (tab === "butik" ? " on" : "") + '" data-tab="butik">🛒 Butik</button></div>' +
        '<div class="points-line' + (g.points < 0 ? " neg" : "") + '">⭐ ' + G.fmt(g.points) + " poäng</div>";
      if (tab === "bygg") {
        html += '<p class="instr">Välj något och tryck på en ruta. Dra med fingret för att lägga många klossar.</p>';
        html += '<div class="palette"><button class="pal' + (tool === "erase" ? " on" : "") + '" data-tool="erase" title="Ta bort">🧽<small>Ta bort</small></button>';
        var any = false;
        var mine = w.items.concat(G.BLOCKS).concat(G.TIERS.map(function (_, i) { return G.ITEMS["pokal-" + i]; }));
        mine.forEach(function (it) {
          var n = owned(it.id);
          if (!n) return;
          any = true;
          html += '<button class="pal' + (tool === it.id ? " on" : "") + '" data-tool="' + it.id + '" title="' + P.esc(it.name) + '">' +
            cellHTML(it, 36) + '<span class="cnt">' + n + "</span></button>";
        });
        // saker från andra världar
        Object.keys(g.inv).forEach(function (id) {
          var it = G.ITEMS[id];
          if (!it || it.kind !== "emoji" || it.world === wid || !g.inv[id]) return;
          any = true;
          html += '<button class="pal' + (tool === id ? " on" : "") + '" data-tool="' + id + '" title="' + P.esc(it.name) + '">' +
            cellHTML(it, 36) + '<span class="cnt">' + g.inv[id] + "</span></button>";
        });
        html += "</div>";
        if (!any) html += '<p class="small muted">Du har inget att bygga med än. Gå till Butik.</p>';
      } else {
        html += "<h4>" + w.icon + " " + P.esc(w.name) + "</h4>" + shopList(w.items);
        html += "<h4>🧱 Klossar</h4>" + shopList(G.BLOCKS, true);
        html += "<h4>💎 Exklusiva saker</h4><p class=\"small muted\">Finns inte i butiken. Du får dem på nivå Guld och Diamant i " +
          '<a href="#/prestationer">prestationer</a>, tillsammans med medaljer och klossar.</p><div class="specials">' +
          G.SPECIAL.map(function (it) {
            return '<span class="special' + (owned(it.id) ? "" : " missing") + '" title="' + P.esc(it.name) + '">' + cellHTML(it, 34) + "</span>";
          }).join("") + "</div>";
      }
      panel.innerHTML = html;
      bindPanel();
    }

    function shopList(items, blocks) {
      return '<div class="shop">' + items.map(function (it) {
        var can1 = g.points >= it.price, can10 = g.points >= it.price * 10;
        return '<div class="shop-item"><span class="shop-ico">' + cellHTML(it, 34) + "</span>" +
          '<span class="shop-name">' + P.esc(it.name) + '<br><small class="muted">' + G.fmt(it.price) + " p" +
          (owned(it.id) ? " · du har " + owned(it.id) : "") + "</small></span>" +
          '<button class="btn small" data-buy="' + it.id + '" data-qty="1"' + (can1 ? "" : " disabled") + ">Köp</button>" +
          (blocks ? '<button class="btn small" data-buy="' + it.id + '" data-qty="10"' + (can10 ? "" : " disabled") + ">×10</button>" : "") +
          "</div>";
      }).join("") + "</div>";
    }

    function bindPanel() {
      Array.prototype.forEach.call(panel.querySelectorAll("[data-tab]"), function (b) {
        b.onclick = function () { tab = b.getAttribute("data-tab"); drawPanel(); };
      });
      Array.prototype.forEach.call(panel.querySelectorAll("[data-tool]"), function (b) {
        b.onclick = function () { tool = b.getAttribute("data-tool"); drawPanel(); };
      });
      Array.prototype.forEach.call(panel.querySelectorAll("[data-buy]"), function (b) {
        b.onclick = function () {
          var id = b.getAttribute("data-buy"), q = +b.getAttribute("data-qty");
          var ev = G.buy(id, q);
          if (ev) {
            G.toast("<div>Köpt: <b>" + P.esc(G.ITEMS[id].name) + (q > 1 ? " ×" + q : "") + "</b></div>");
            G.showEvents(ev);
            if (!tool) tool = id;
          }
          drawPanel();
        };
      });
    }

    function applyAt(cell) {
      if (!cell || !tool) return false;
      var changed = tool === "erase" ? G.remove(wid, cell) : G.place(wid, cell, tool);
      if (changed) {
        g = G.state();
        var el = stage.querySelector('[data-cell="' + cell + '"]');
        var id = g.worlds[wid].grid[cell];
        if (el) el.innerHTML = id ? cellHTML(G.ITEMS[id], cellSize()) : "";
        if (tool !== "erase" && !(g.inv[tool] > 0)) tool = null;
      }
      return changed;
    }

    function bindScene() {
      var scene = stage.querySelector(".scene");
      var down = false, last = null, changed = false;
      function cellFromEvent(e) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        while (el && el !== scene && !(el.getAttribute && el.getAttribute("data-cell"))) el = el.parentNode;
        return el && el.getAttribute ? el.getAttribute("data-cell") : null;
      }
      scene.addEventListener("pointerdown", function (e) {
        down = true; changed = false;
        last = cellFromEvent(e);
        if (applyAt(last)) changed = true;
        if (scene.setPointerCapture) try { scene.setPointerCapture(e.pointerId); } catch (x) {}
      });
      scene.addEventListener("pointermove", function (e) {
        if (!down) return;
        var c = cellFromEvent(e);
        if (c && c !== last) {
          last = c;
          // dra bara med klossar och suddgummi
          var it = G.ITEMS[tool];
          if (tool === "erase" || (it && it.kind === "block")) { if (applyAt(c)) changed = true; }
        }
      });
      function up() { if (down && changed) drawPanel(); down = false; }
      scene.addEventListener("pointerup", up);
      scene.addEventListener("pointercancel", up);
    }

    drawScene();
    drawPanel();
    var rt = null;
    ctx.onResize(function () { clearTimeout(rt); rt = setTimeout(drawScene, 150); });
  };

  /* ---------- Sida: prestationer ---------- */
  G.viewAchievements = function (ctx) {
    ctx.setCrumb([{ t: "Start", href: "#/" }, { t: "Mina världar", href: "#/varldar" }, { t: "Prestationer" }]);
    var g = G.state();
    var html = '<h1 class="page-title">Prestationer</h1><p class="instr">Varje prestation kan du få många gånger. ' +
      "Ju fler gånger, desto finare material: " + G.TIERS.map(function (t) { return t.n; }).join(" → ") +
      ". Varje ny nivå ger bonuspoäng, en medalj och klossar. Från Sten får du också en sak, " +
      "och på Guld och Diamant en <b>exklusiv sak</b> som inte finns i butiken.</p><div class=\"cards ach-cards\">";
    G.ACH.forEach(function (a) {
      var n = g.ach[a.id] || 0;
      var t = a.once ? (n ? null : -1) : tierFor(n);
      var medal = (a.once ? n > 0 : t >= 0) ? G.medalHTML(a.once ? null : t, a.icon, 56) : '<span class="medal off" style="width:56px;height:56px;font-size:28px">' + a.icon + "</span>";
      var next = a.once ? null : G.TIERS[t + 1];
      var prev = a.once ? 0 : t >= 0 ? G.TIERS[t].at : 0;
      html += '<div class="card ach-card">' + medal + '<div class="ach-body"><h3>' + P.esc(a.name) +
        (a.once ? "" : t >= 0 ? ' <span class="tier" style="background:' + G.TIERS[t].c2 + '">' + G.TIERS[t].n + "</span>" : "") + "</h3>" +
        '<p class="small muted">' + P.esc(a.desc) + "</p>";
      if (a.once) html += '<p class="small">' + (n ? "Klar! ✓" : "Inte än") + "</p>";
      else if (next) {
        html += '<div class="bar"><span style="width:' + Math.round(((n - prev) / (next.at - prev)) * 100) + '%"></span></div>' +
          '<p class="small">' + n + " av " + next.at + " till " + next.n + "</p>";
      } else html += '<p class="small">' + n + " gånger – högsta nivån! 💎</p>";
      html += "</div></div>";
    });
    html += "</div>";
    ctx.main.innerHTML = html;
  };
})();
