/* Själva appen: startsida, val av övning, de tre övningarna och statistik. */
(function () {
  "use strict";
  var P = window.P;
  var main = document.getElementById("main");
  var crumb = document.getElementById("crumb");
  var currentMap = null;
  var lists = [];
  var base = null;

  var MODES = {
    placera: { title: "Sätt ut numren", icon: "🔢", desc: "Namnen står i en lista. Sätt rätt nummer på rätt plats på kartan." },
    skriv: { title: "Skriv namnen", icon: "✏️", desc: "Kartan har nummer. Skriv vad varje nummer heter." },
    hitta: { title: "Hitta på kartan", icon: "📍", desc: "Ett namn visas. Tryck där du tror att det ligger." },
  };
  var RADII = [
    { r: 250, t: "Lätt (250 km)" },
    { r: 120, t: "Medel (120 km)" },
    { r: 50, t: "Svår (50 km)" },
  ];
  var WEAK_LIMIT = 0.75;

  /* ---------- hjälp ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function findList(id) { for (var i = 0; i < lists.length; i++) if (lists[i].id === id) return lists[i]; return null; }
  function itemById(list, id) { for (var i = 0; i < list.items.length; i++) if (list.items[i].id === id) return list.items[i]; return null; }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function finePointer() { return window.matchMedia && window.matchMedia("(pointer: fine)").matches; }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var q = {};
    var i = h.indexOf("?");
    if (i >= 0) {
      h.slice(i + 1).split("&").forEach(function (kv) {
        var p = kv.split("=");
        if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
      h = h.slice(0, i);
    }
    return { parts: h.split("/").filter(Boolean).map(decodeURIComponent), q: q };
  }
  function go(h) { location.hash = h; }

  /** Platser man behöver träna mer på (haft fel på), sämst först. */
  function weakItems(list) {
    var res = P.store.results(list.id);
    return list.items
      .map(function (it) { return { item: it, r: res[it.id], m: P.mastery(res[it.id]) }; })
      .filter(function (x) {
        if (x.m === null) return false;
        var last = x.r.last || [];
        return x.m < WEAK_LIMIT || last[last.length - 1] === 0;
      })
      .sort(function (a, b) { return a.m - b.m; });
  }
  function listProgress(list) {
    var res = P.store.results(list.id);
    var practiced = 0, good = 0;
    list.items.forEach(function (it) {
      var m = P.mastery(res[it.id]);
      if (m !== null) practiced++;
      if (m !== null && m >= WEAK_LIMIT) good++;
    });
    return { practiced: practiced, good: good, total: list.items.length };
  }

  function setCrumb(parts) {
    crumb.innerHTML = parts
      .map(function (p) { return p.href ? '<a href="' + p.href + '">' + P.esc(p.t) + "</a>" : "<span>" + P.esc(p.t) + "</span>"; })
      .join('<span class="sep">›</span>');
  }

  function updateProfileButton() {
    var p = P.store.profile();
    $("#profile-btn").textContent = "👤 " + (p ? p.name : "Vem övar?");
  }

  function teardown() {
    if (currentMap) currentMap.destroy();
    currentMap = null;
    document.body.classList.remove("playing");
    document.onkeydown = null;
  }

  /* ---------- profil ---------- */
  function askProfile(done) {
    var dlg = document.createElement("div");
    dlg.className = "modal";
    dlg.innerHTML =
      '<div class="modal-box"><h2>Vem övar?</h2>' +
      '<p>Skriv ditt namn så sparas dina resultat på den här datorn/iPaden.</p>' +
      '<form><input name="n" maxlength="30" autocomplete="off" placeholder="Ditt namn" required>' +
      '<div class="row"><button type="submit" class="btn primary">Klar</button>' +
      '<button type="button" class="btn ghost" data-skip>Hoppa över</button></div></form></div>';
    document.body.appendChild(dlg);
    var input = $("input", dlg);
    setTimeout(function () { input.focus(); }, 50);
    $("form", dlg).onsubmit = function (e) {
      e.preventDefault();
      var n = input.value.trim();
      if (n) P.store.addProfile(n);
      dlg.remove();
      updateProfileButton();
      if (done) done();
    };
    $("[data-skip]", dlg).onclick = function () {
      P.store.pref("skipProfile", true);
      dlg.remove();
      if (done) done();
    };
  }

  /* ---------- startsida ---------- */
  function viewHome() {
    setCrumb([{ t: "Start" }]);
    var groups = {};
    var order = [];
    lists.forEach(function (l) {
      var key = (l.subject || "Övrigt") + " – " + (l.section || "");
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(l);
    });
    var p = P.store.profile();
    var html = '<section class="hero"><h1>' + (p ? "Hej " + P.esc(p.name) + "! " : "") + "Vad vill du öva på?</h1></section>";
    order.forEach(function (key) {
      html += '<h2 class="section-title">' + P.esc(key) + '</h2><div class="cards">';
      groups[key].forEach(function (l) {
        var pr = listProgress(l);
        var weak = weakItems(l).length;
        html +=
          '<a class="card list-card" href="#/lista/' + encodeURIComponent(l.id) + '">' +
          "<h3>" + P.esc(l.title) + "</h3>" +
          '<p class="muted">' + l.items.length + " platser</p>" +
          '<div class="bar"><span style="width:' + pct(pr.good / pr.total) + '"></span></div>' +
          '<p class="small">' + pr.good + " av " + pr.total + " kan du" +
          (weak ? ' · <b class="warn">' + weak + " att träna mer på</b>" : "") + "</p></a>";
      });
      html += "</div>";
    });
    html += '<p class="small muted footer-links"><a href="#/statistik">Statistik</a> · <a href="edit.html">Redigera listor (för vuxna)</a></p>';
    main.innerHTML = html;
  }

  /* ---------- välj övning ---------- */
  function viewList(id) {
    var list = findList(id);
    if (!list) return viewNotFound();
    setCrumb([{ t: "Start", href: "#/" }, { t: list.title }]);
    var saved = P.store.pref("groups:" + id) || list.groups.map(function (g) { return g.id; });
    var radius = P.store.pref("radius") || 120;
    var weak = weakItems(list);

    var html = '<h1 class="page-title">' + P.esc(list.title) + "</h1>";
    html += '<div class="options card"><h3>Vad ska ingå?</h3><div class="checks">';
    list.groups.forEach(function (g) {
      var n = list.items.filter(function (it) { return it.group === g.id; }).length;
      html += '<label class="check"><input type="checkbox" name="g" value="' + P.esc(g.id) + '"' +
        (saved.indexOf(g.id) >= 0 ? " checked" : "") + "> " + P.esc(g.title) + ' <span class="muted">(' + n + ")</span></label>";
    });
    html += "</div>";
    html += '<label class="check" id="weak-label"><input type="checkbox" name="weak"> Bara det jag behöver träna mer på ' +
      '<span class="muted" id="weak-count"></span></label>';
    html += '<label class="check"><input type="checkbox" name="mix"> Blanda numren (inte samma som på provpappret)</label>';
    html += '<div class="radius"><span>Svårighet för "Hitta på kartan":</span> ';
    RADII.forEach(function (o) {
      html += '<label class="pill"><input type="radio" name="r" value="' + o.r + '"' + (o.r === radius ? " checked" : "") + "><span>" + o.t + "</span></label>";
    });
    html += "</div></div>";

    html += '<div class="cards modes">';
    Object.keys(MODES).forEach(function (k) {
      var m = MODES[k];
      html += '<button type="button" class="card mode-card" data-mode="' + k + '"><div class="icon">' + m.icon + "</div><h3>" +
        m.title + "</h3><p>" + m.desc + "</p></button>";
    });
    html += "</div>";

    html += '<div class="card weak-box" id="weak-box"></div>';
    main.innerHTML = html;

    function checkedGroups() {
      return $all('input[name="g"]:checked').map(function (c) { return c.value; });
    }
    // "Behöver träna mer på" visar bara det som ingår i de valda grupperna
    function updateWeak() {
      var gs = checkedGroups();
      var w = weak.filter(function (x) { return gs.indexOf(x.item.group) >= 0; });
      var cb = $('input[name="weak"]');
      if (!w.length) cb.checked = false;
      cb.disabled = !w.length;
      $("#weak-label").classList.toggle("disabled", !w.length);
      $("#weak-count").textContent = "(" + w.length + " st)";
      var box = $("#weak-box");
      box.style.display = w.length ? "" : "none";
      box.innerHTML = w.length ? "<h3>Behöver träna mer på</h3>" + weakChips(w) : "";
    }
    $all('input[name="g"]').forEach(function (c) { c.onchange = updateWeak; });
    updateWeak();

    $all(".mode-card").forEach(function (b) {
      b.onclick = function () {
        var gs = checkedGroups();
        var w = $('input[name="weak"]').checked;
        if (!gs.length) { alert("Välj minst en sak att öva på."); return; }
        var r = +$('input[name="r"]:checked').value;
        P.store.pref("groups:" + id, gs);
        P.store.pref("radius", r);
        var q = ["g=" + gs.join(","), "r=" + r];
        if (w) q.push("weak=1");
        if ($('input[name="mix"]').checked) q.push("mix=1");
        go("#/ova/" + encodeURIComponent(id) + "/" + b.getAttribute("data-mode") + "?" + q.join("&"));
      };
    });
  }

  function weakChips(weak) {
    return '<div class="chips">' + weak.map(function (x) {
      var cls = x.m < 0.4 ? "bad" : "meh";
      return '<span class="chip ' + cls + '" title="' + x.r.ok + " rätt av " + x.r.n + '">' + P.esc(x.item.name) +
        ' <small>' + pct(x.m) + "</small></span>";
    }).join("") + "</div>";
  }

  /* ---------- gemensamt för övningarna ---------- */
  function selectItems(list, q) {
    var groups = (q.g || "").split(",").filter(Boolean);
    var inGroups = function (it) { return !groups.length || groups.indexOf(it.group) >= 0; };
    var items;
    if (q.ids) {
      // Exakt de här platserna (t.ex. "Öva på det jag hade fel")
      var ids = q.ids.split(",");
      items = list.items.filter(function (it) { return ids.indexOf(it.id) >= 0; });
    } else if (q.weak) {
      items = weakItems(list).map(function (x) { return x.item; }).filter(inGroups);
    } else {
      items = list.items.filter(inGroups);
    }
    items = items.map(function (it) { return Object.assign({}, it, { show: it.label }); });
    if (q.mix) {
      var nums = P.shuffle(items.map(function (_, i) { return String(i + 1); }));
      items.forEach(function (it, i) { it.show = nums[i]; });
      items.sort(function (a, b) { return +a.show - +b.show; });
    } else {
      items.sort(function (a, b) { return P.byLabel({ label: a.show }, { label: b.show }); });
    }
    return items;
  }

  function playLayout(list, mode) {
    document.body.classList.add("playing");
    setCrumb([{ t: "Start", href: "#/" }, { t: list.title, href: "#/lista/" + encodeURIComponent(list.id) }, { t: MODES[mode].title }]);
    main.innerHTML = '<div class="play"><div class="play-map" id="map"></div><aside class="play-panel" id="panel"></aside></div>';
    return $("#panel");
  }

  /** Små länder/ytor får en prick med bubblan bredvid, så att bubblan inte döljer dem. */
  function isSmall(it) {
    if (!it.shape || !/Polygon/.test(it.shape.type)) return false;
    if (it._small === undefined) {
      var b = d3.geoBounds(it.shape);
      var w = Math.abs(b[1][0] - b[0][0]) * Math.cos(((b[0][1] + b[1][1]) / 2) * Math.PI / 180);
      var h = Math.abs(b[1][1] - b[0][1]);
      it._small = Math.max(w, h) < 2.2;
    }
    return it._small;
  }

  function markerFor(it, text, cls) {
    return {
      id: it.id,
      pos: it.pos,
      text: text,
      cls: cls || "",
      point: it.type === "capital" || it.type === "peak" || it.type === "city" || !it.shape || isSmall(it),
      pinShape: it.type === "peak" ? "triangle" : "dot",
    };
  }

  function finishBox(score, total, items, wrongIds, list, mode, q) {
    var ratio = total ? score / total : 0;
    var msg = ratio === 1 ? "Alla rätt! 🌟" : ratio >= 0.8 ? "Riktigt bra! 👏" : ratio >= 0.5 ? "Bra kämpat! 💪" : "Fortsätt öva, det blir bättre! 🙂";
    var wrong = items.filter(function (it) { return wrongIds.indexOf(it.id) >= 0; });
    var again = "#/ova/" + encodeURIComponent(list.id) + "/" + mode + "?" +
      Object.keys(q).map(function (k) { return k + "=" + encodeURIComponent(q[k]); }).join("&");
    var html = '<div class="result-box"><div class="big">' + score + " / " + total + "</div><p>" + msg + "</p>";
    if (wrong.length) {
      html += '<p class="small">Öva mer på:</p><div class="chips">' +
        wrong.map(function (it) { return '<span class="chip bad">' + P.esc(it.name) + "</span>"; }).join("") + "</div>";
    }
    html += '<div class="row wrap"><a class="btn primary" href="' + again + "&t=" + Date.now() + '">Kör igen</a>';
    if (wrong.length) {
      html += '<a class="btn" href="#/ova/' + encodeURIComponent(list.id) + "/" + mode + "?ids=" +
        encodeURIComponent(wrongIds.join(",")) + "&r=" + (q.r || 120) + (q.mix ? "&mix=1" : "") + "&t=" + Date.now() + '">Öva på det jag hade fel</a>';
    }
    html += '<a class="btn ghost" href="#/lista/' + encodeURIComponent(list.id) + '">Välj annat</a></div></div>';
    return html;
  }

  /* ---------- Övning 1: sätt ut numren ---------- */
  function playPlacera(list, q) {
    var items = selectItems(list, q);
    if (!items.length) return emptyPlay(list);
    var panel = playLayout(list, "placera");
    var answers = {}; // itemId -> show-label
    var selectedMarker = null, selectedLabel = null, checked = false;

    currentMap = new P.MapView($("#map"), base, {
      view: list.view, style: list.style,
      onMarker: function (id) {
        if (checked) return;
        if (selectedLabel != null) { assign(id, selectedLabel); selectedLabel = null; refresh(); return; }
        selectedMarker = selectedMarker === id ? null : id;
        refresh();
        if (selectedMarker && finePointer()) { var inp = $("#typed"); if (inp) inp.focus(); }
      },
    });
    var markerItems = P.shuffle(items); // ordning på kartan avslöjar inget
    currentMap.setMarkers(markerItems.map(function (it) { return markerFor(it, "", ""); }));

    function assign(markerId, label) {
      Object.keys(answers).forEach(function (k) { if (answers[k] === label) delete answers[k]; });
      if (label === "") delete answers[markerId];
      else answers[markerId] = label;
    }

    function render() {
      var html = '<p class="instr">Tryck på en ring på kartan och sedan på rätt namn i listan.</p>';
      html += '<div class="typed-row' + (selectedMarker ? "" : " hidden") + '"><label>Nummer: <input id="typed" autocomplete="off" size="4"></label>' +
        '<button class="btn small" id="clear-one" type="button">Töm</button></div>';
      html += '<ol class="name-list">';
      items.forEach(function (it) {
        var used = Object.keys(answers).some(function (k) { return answers[k] === it.show; });
        html += '<li data-label="' + P.esc(it.show) + '" class="' + (used ? "used " : "") + (selectedLabel === it.show ? "sel" : "") + '">' +
          '<span class="num">' + P.esc(it.show) + "</span> " + P.esc(it.name) + (used ? ' <span class="tick">✓</span>' : "") + "</li>";
      });
      html += '</ol><div class="row sticky-bottom"><button class="btn primary" id="check" type="button">Rätta</button>' +
        '<span class="muted small">' + Object.keys(answers).length + " av " + items.length + " ifyllda</span></div><div id='result'></div>";
      panel.innerHTML = html;

      $all(".name-list li", panel).forEach(function (li) {
        li.onclick = function () {
          if (checked) return;
          var label = li.getAttribute("data-label");
          if (selectedMarker) { assign(selectedMarker, label); selectedMarker = null; }
          else selectedLabel = selectedLabel === label ? null : label;
          refresh();
        };
      });
      var typed = $("#typed", panel);
      typed.onkeydown = function (e) {
        if (e.key === "Enter") {
          var v = typed.value.trim().toLowerCase();
          var match = items.filter(function (it) { return String(it.show).toLowerCase() === v; })[0];
          if (match && selectedMarker) { assign(selectedMarker, match.show); selectedMarker = null; refresh(); }
          else typed.select();
        } else if (e.key === "Escape") { selectedMarker = null; refresh(); }
      };
      $("#clear-one", panel).onclick = function () { if (selectedMarker) { assign(selectedMarker, ""); selectedMarker = null; refresh(); } };
      $("#check", panel).onclick = check;
    }

    function refresh() {
      currentMap.updateAll(function (m) {
        return { text: answers[m.id] || "", cls: (m.id === selectedMarker ? "sel " : "") + (answers[m.id] ? "filled" : "") };
      });
      currentMap.clearShapes();
      if (selectedMarker) currentMap.showShape(itemById(list, selectedMarker), "hl");
      render();
    }

    function check() {
      if (Object.keys(answers).length < items.length &&
          !confirm("Du har inte fyllt i alla. Vill du rätta ändå?")) return;
      checked = true;
      var score = 0, wrong = [];
      items.forEach(function (it) {
        var ok = answers[it.id] === it.show;
        if (ok) score++; else wrong.push(it.id);
        P.store.record(list.id, it.id, ok);
      });
      P.store.session(list.id, "placera", score, items.length);
      currentMap.updateAll(function (m) {
        var it = items.filter(function (x) { return x.id === m.id; })[0];
        var ok = answers[m.id] === it.show;
        return { text: it.show, cls: ok ? "correct" : "wrong" };
      });
      currentMap.clearShapes();
      $all(".name-list li", panel).forEach(function (li) {
        var it = items.filter(function (x) { return x.show === li.getAttribute("data-label"); })[0];
        li.className = wrong.indexOf(it.id) >= 0 ? "wrong" : "correct";
      });
      $("#check", panel).disabled = true;
      $("#result", panel).innerHTML = '<p class="small">Röda ringar visar rätt nummer där du hade fel.</p>' + finishBox(score, items.length, items, wrong, list, "placera", q);
      $("#result", panel).scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    refresh();
  }

  /* ---------- Övning 2: skriv namnen ---------- */
  function playSkriv(list, q) {
    var items = selectItems(list, q);
    if (!items.length) return emptyPlay(list);
    var panel = playLayout(list, "skriv");
    var checked = false;

    currentMap = new P.MapView($("#map"), base, {
      view: list.view, style: list.style,
      onMarker: function (id) {
        var inp = $('input[data-id="' + id + '"]', panel);
        if (inp) { inp.focus(); inp.scrollIntoView({ block: "nearest" }); }
      },
    });
    currentMap.setMarkers(items.map(function (it) { return markerFor(it, it.show, ""); }));

    var html = '<p class="instr">Skriv namnet på varje nummer. Tryck på ett nummer på kartan för att hoppa dit.</p><div class="write-list">';
    items.forEach(function (it) {
      html += '<label class="write-row" data-row="' + P.esc(it.id) + '"><span class="num">' + P.esc(it.show) + "</span>" +
        '<input data-id="' + P.esc(it.id) + '" autocomplete="off" autocapitalize="words" spellcheck="false">' +
        '<span class="fb"></span></label>';
    });
    html += '</div><div class="row sticky-bottom"><button class="btn primary" id="check" type="button">Rätta</button></div><div id="result"></div>';
    panel.innerHTML = html;

    var inputs = $all("input[data-id]", panel);
    inputs.forEach(function (inp, i) {
      var it = itemById(list, inp.getAttribute("data-id"));
      inp.onfocus = function () {
        currentMap.updateAll(function (m) { return { cls: (m.cls || "").replace(/\bsel\b/g, "").trim() + (m.id === it.id ? " sel" : "") }; });
        if (!checked) { currentMap.clearShapes(); currentMap.showShape(it, "hl"); }
      };
      inp.onkeydown = function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (inputs[i + 1]) inputs[i + 1].focus(); else inp.blur();
        }
      };
    });

    $("#check", panel).onclick = function () {
      var empty = inputs.filter(function (x) { return !x.value.trim(); }).length;
      if (empty && !confirm(empty + " rutor är tomma. Vill du rätta ändå?")) return;
      checked = true;
      var score = 0, wrong = [];
      currentMap.clearShapes();
      inputs.forEach(function (inp) {
        var it = items.filter(function (x) { return x.id === inp.getAttribute("data-id"); })[0];
        var res = P.checkAnswer(inp.value, it);
        var ok = res !== "wrong";
        var row = inp.parentNode;
        row.classList.add(ok ? "correct" : "wrong");
        inp.readOnly = true;
        var fb = $(".fb", row);
        if (res === "correct") fb.textContent = "✓";
        else if (res === "close") fb.innerHTML = "✓ <small>stavas " + P.esc(it.name) + "</small>";
        else fb.innerHTML = "✗ <small>" + P.esc(it.name) + "</small>";
        if (ok) score++; else wrong.push(it.id);
        P.store.record(list.id, it.id, ok);
        currentMap.updateMarker(it.id, { cls: ok ? "correct" : "wrong" });
      });
      P.store.session(list.id, "skriv", score, items.length);
      this.disabled = true;
      $("#result", panel).innerHTML = finishBox(score, items.length, items, wrong, list, "skriv", q);
      $("#result", panel).scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    if (finePointer() && inputs[0]) inputs[0].focus();
  }

  /* ---------- Övning 3: hitta på kartan ---------- */
  function playHitta(list, q) {
    var items = selectItems(list, q);
    if (!items.length) return emptyPlay(list);
    var R = +q.r || 120;
    var panel = playLayout(list, "hitta");
    var queue = q.weak ? items.slice() : P.shuffle(items);
    if (q.weak) {
      // svårast först
      var res = P.store.results(list.id);
      queue.sort(function (a, b) { return (P.mastery(res[a.id]) || 0) - (P.mastery(res[b.id]) || 0); });
    }
    var idx = 0, answered = false, correctCount = 0, points = 0, wrong = [];

    currentMap = new P.MapView($("#map"), base, {
      view: list.view, style: list.style, noDblZoom: true,
      onClick: function (ll) { answer(ll); },
    });

    function show() {
      answered = false;
      currentMap.clearShapes();
      currentMap.clearPins();
      var it = queue[idx];
      panel.innerHTML =
        '<div class="progress small muted">Fråga ' + (idx + 1) + " av " + queue.length + " · Poäng: " + points + "</div>" +
        '<div class="prompt"><div class="muted small">Var ligger…</div><div class="target-name">' + P.esc(it.name) + "</div>" +
        '<div class="muted small">' + P.esc(it.hint || P.TYPE_NAMES[it.type] || "") + "</div></div>" +
        '<p class="instr">Tryck på kartan. Rätt om du är inom ' + R + " km" + (P.isCityType(it) ? " och i rätt land" : "") +
        ". Zooma med två fingrar eller +/−.</p>" +
        '<div id="feedback"></div>';
    }

    function answer(ll) {
      if (answered) return;
      answered = true;
      var it = queue[idx];
      var d = P.distanceToItem(ll, it);
      var ok = d.km <= R;
      var pts = ok ? 100 : Math.max(0, Math.round(100 * (1 - (d.km - R) / (4 * R))));
      // Städer: trycker man i ett annat land blir det fel och 0 poäng, även inom radien
      var home = null, otherCountry = null;
      if (P.isCityType(it)) {
        home = P.homeCountry(base, it);
        var at = P.countryAt(base, ll);
        if (home && at && at !== home) {
          otherCountry = at;
          ok = false;
          pts = 0;
        }
      }
      points += pts;
      if (ok) correctCount++; else wrong.push(it.id);
      P.store.record(list.id, it.id, ok);
      if (home) currentMap.showShape({ id: "__home", shape: home.geometry }, ok ? "correct country" : "wrong country");
      currentMap.showShape(it, ok ? "correct" : "wrong");
      currentMap.showPin(ll, ok ? "guess ok" : "guess bad");
      if (d.km > 0) currentMap.showLine(ll, d.nearest, ok ? "ok" : "bad");
      var km = d.km < 1 ? "pricken mitt i" : Math.round(d.km) + " km bort";
      var last = idx === queue.length - 1;
      var msg;
      if (otherCountry) {
        msg = "Du tryckte i " + P.esc(otherCountry.properties.n) + ", men " + P.esc(it.name) + " ligger i " +
          P.esc(home.properties.n) + ". Du var " + km + ".";
      } else {
        msg = d.km < 1 ? "Mitt i prick! 🎯" : "Du var " + km + ".";
      }
      $("#feedback").innerHTML =
        '<div class="fb-box ' + (ok ? "ok" : "bad") + '"><b>' + (ok ? "Rätt! " : "Inte riktigt. ") + "</b>" +
        msg + " <span class='muted'>+" + pts + " poäng</span></div>" +
        '<button class="btn primary big-btn" id="next" type="button">' + (last ? "Visa resultat" : "Nästa") + "</button>";
      var next = $("#next");
      next.onclick = function () {
        if (last) return finish();
        idx++;
        show();
      };
      if (finePointer()) next.focus();
    }

    function finish() {
      P.store.session(list.id, "hitta", correctCount, queue.length);
      currentMap.clearShapes();
      currentMap.clearPins();
      wrong.forEach(function (id) { currentMap.showShape(itemById(list, id), "wrong"); });
      panel.innerHTML = '<div class="progress small muted">Poäng: ' + points + " av " + queue.length * 100 + "</div>" +
        finishBox(correctCount, queue.length, queue, wrong, list, "hitta", q) +
        (wrong.length ? '<p class="small muted">De röda på kartan är de du missade.</p>' : "");
    }

    document.onkeydown = function (e) {
      if (e.key === "Enter" && answered) { var n = $("#next"); if (n) n.click(); }
    };
    show();
  }

  function emptyPlay(list) {
    main.innerHTML = '<div class="card"><p>Det finns inget att öva på med de valen.</p><a class="btn" href="#/lista/' +
      encodeURIComponent(list.id) + '">Tillbaka</a></div>';
  }

  /* ---------- statistik ---------- */
  function viewStats() {
    setCrumb([{ t: "Start", href: "#/" }, { t: "Statistik" }]);
    var s = P.store.get();
    var p = P.store.profile();
    var html = '<h1 class="page-title">Statistik' + (p ? " för " + P.esc(p.name) : "") + "</h1>";
    html += '<div class="card profiles"><h3>Vem övar?</h3><div class="row wrap">';
    s.profiles.forEach(function (pr) {
      html += '<button class="btn' + (pr.id === s.current ? " primary" : "") + '" data-prof="' + pr.id + '">' + P.esc(pr.name) + "</button>";
    });
    html += '<button class="btn ghost" id="new-prof">+ Ny person</button>';
    if (p) html += '<button class="btn ghost danger" id="del-prof">Ta bort ' + P.esc(p.name) + "</button>";
    html += '</div><p class="small muted">Resultaten sparas bara på den här enheten, i den här webbläsaren.</p></div>';

    lists.forEach(function (l) {
      var pr = listProgress(l);
      var weak = weakItems(l);
      var res = P.store.results(l.id);
      html += '<div class="card stat-card"><h3>' + P.esc(l.title) + "</h3>" +
        '<div class="bar"><span style="width:' + pct(pr.good / pr.total) + '"></span></div>' +
        '<p class="small">' + pr.good + " av " + pr.total + " kan du · " + pr.practiced + " övade · " + (pr.total - pr.practiced) + " inte övade än</p>";
      if (weak.length) {
        html += '<h4>Behöver träna mer på (' + weak.length + ")</h4>" + weakChips(weak) +
          '<div class="row wrap"><a class="btn primary" href="#/ova/' + encodeURIComponent(l.id) + "/hitta?weak=1&all=1&r=" + (P.store.pref("radius") || 120) +
          '">📍 Öva på dessa – hitta på kartan</a>' +
          '<a class="btn" href="#/ova/' + encodeURIComponent(l.id) + '/skriv?weak=1&all=1">✏️ Öva på dessa – skriv namnen</a></div>';
      } else if (pr.practiced) {
        html += '<p class="good">Inget du haft fel på just nu. 🌟</p>';
      }
      if (pr.practiced) {
        html += '<details><summary>Alla platser</summary><table class="stat-table"><tr><th>Plats</th><th>Rätt</th><th>Senaste</th></tr>';
        l.items.slice().sort(function (a, b) {
          var ma = P.mastery(res[a.id]), mb = P.mastery(res[b.id]);
          return (ma === null ? 2 : ma) - (mb === null ? 2 : mb);
        }).forEach(function (it) {
          var r = res[it.id];
          var m = P.mastery(r);
          var cls = m === null ? "" : m >= WEAK_LIMIT ? "good" : m >= 0.4 ? "meh" : "bad";
          html += '<tr class="' + cls + '"><td>' + P.esc(it.name) + "</td><td>" + (r ? r.ok + " av " + r.n : "–") + "</td><td>" +
            (r ? (r.last || []).map(function (x) { return x ? "✓" : "✗"; }).join(" ") : "") + "</td></tr>";
        });
        html += "</table></details>";
      }
      html += "</div>";
    });

    var sess = P.store.sessions().slice(-15).reverse();
    if (sess.length) {
      html += '<div class="card"><h3>Senaste omgångarna</h3><table class="stat-table"><tr><th>När</th><th>Lista</th><th>Övning</th><th>Resultat</th></tr>';
      sess.forEach(function (x) {
        var l = findList(x.list);
        var d = new Date(x.t);
        html += "<tr><td>" + d.toLocaleDateString("sv-SE") + " " + d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) + "</td><td>" +
          P.esc(l ? l.title : x.list) + "</td><td>" + P.esc(MODES[x.mode] ? MODES[x.mode].title : x.mode) + "</td><td>" + x.score + " / " + x.total + "</td></tr>";
      });
      html += "</table></div>";
    }
    main.innerHTML = html;

    $all("[data-prof]").forEach(function (b) {
      b.onclick = function () { P.store.setProfile(b.getAttribute("data-prof")); updateProfileButton(); viewStats(); };
    });
    $("#new-prof").onclick = function () { askProfile(viewStats); };
    var del = $("#del-prof");
    if (del) del.onclick = function () {
      if (confirm("Ta bort " + p.name + " och alla resultat?")) { P.store.removeProfile(p.id); updateProfileButton(); viewStats(); }
    };
  }

  function viewNotFound() {
    main.innerHTML = '<div class="card"><p>Hittade inte sidan.</p><a class="btn" href="#/">Till start</a></div>';
  }

  /* ---------- router ---------- */
  function route() {
    teardown();
    window.scrollTo(0, 0);
    var h = parseHash();
    var p = h.parts;
    if (!p.length) return viewHome();
    if (p[0] === "lista" && p[1]) return viewList(p[1]);
    if (p[0] === "statistik") return viewStats();
    if (p[0] === "ova" && p[1] && p[2]) {
      var list = findList(p[1]);
      if (!list) return viewNotFound();
      if (p[2] === "placera") return playPlacera(list, h.q);
      if (p[2] === "skriv") return playSkriv(list, h.q);
      if (p[2] === "hitta") return playHitta(list, h.q);
    }
    viewNotFound();
  }

  function start() {
    main.innerHTML = '<p class="loading">Laddar kartor…</p>';
    Promise.all([P.loadLists(), P.loadBase()])
      .then(function (r) {
        lists = r[0];
        base = r[1];
        updateProfileButton();
        $("#profile-btn").onclick = function () { go("#/statistik"); };
        window.addEventListener("hashchange", route);
        route();
        if (!P.store.profile() && !P.store.pref("skipProfile")) askProfile(route);
      })
      .catch(function (e) {
        main.innerHTML =
          '<div class="card"><h2>Något gick fel</h2><p>' + P.esc(e.message) + "</p>" +
          (location.protocol === "file:" ? "<p>Sidan måste öppnas via webbservern (t.ex. http://localhost:8000), inte som en fil.</p>" : "") +
          "</div>";
      });
  }

  start();
})();
