/* Redigeringssida: skapa/ändra listor, klicka ut platser, rita floder och ytor, ladda ner som fil. */
(function () {
  "use strict";
  var P = window.P;
  var panel = document.getElementById("panel");
  var banner = document.getElementById("banner");
  var map = null, base = null, lists = [], list = null, sel = null;
  var mode = null; // null | "pos" | "line" | "poly"
  var draft = [];
  var dirty = false;
  var TYPES = ["country", "capital", "city", "range", "peak", "sea", "ocean", "lake", "river", "island", "place"];

  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function slug(s) {
    return P.normalize(s).replace(/å|ä/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plats";
  }
  function round3(p) { return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000]; }

  function draftKey() { return "plugga.edit." + (list && list.id); }
  function saveDraft() {
    dirty = true;
    try { localStorage.setItem(draftKey(), JSON.stringify(list)); } catch (e) {}
  }

  function newList() {
    return {
      id: "ny-lista", title: "Ny lista", subject: "Geografi", section: "",
      style: "political", view: map ? map.currentView() : [[-25, 34], [60, 71]],
      groups: [{ id: "alla", title: "Alla" }], items: [],
    };
  }

  function loadList(l) {
    list = JSON.parse(JSON.stringify(l));
    delete list.file;
    var d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey())); } catch (e) {}
    if (d && confirm("Det finns osparade ändringar för \"" + list.title + "\" från förra gången. Vill du fortsätta med dem?")) list = d;
    sel = null;
    dirty = false;
    buildMap();
    render();
  }

  function buildMap() {
    var el = $("#map");
    if (map) map.destroy();
    map = new P.MapView(el, base, {
      view: list.view, style: list.style, noDblZoom: true,
      onClick: onMapClick,
      onMarker: function (id) { if (!mode) { sel = id; render(); } },
    });
    refreshMap();
  }

  function refreshMap() {
    map.setMarkers(list.items.map(function (it) {
      return {
        id: it.id, pos: it.pos, text: it.label || "•",
        cls: it.id === sel ? "sel" : "",
        point: it.type === "capital" || it.type === "peak" || it.type === "city" || !it.shape,
        pinShape: it.type === "peak" ? "triangle" : "dot",
      };
    }));
    map.clearShapes();
    var it = current();
    if (it && it.shape) map.showShape(it, "hl");
    map.showDraft(draft, mode === "poly");
  }

  function current() {
    if (!list) return null;
    for (var i = 0; i < list.items.length; i++) if (list.items[i].id === sel) return list.items[i];
    return null;
  }

  function setMode(m) {
    mode = m;
    draft = [];
    var txt = {
      pos: "Klicka på kartan där platsen ligger",
      line: "Klicka punkter längs floden/bergskedjan. Tryck Klar när du är färdig.",
      poly: "Klicka runt ytan (hav, land…). Tryck Klar när du är färdig.",
    }[m];
    banner.textContent = txt || "";
    banner.classList.toggle("hidden", !m);
    refreshMap();
    render();
  }

  function onMapClick(ll) {
    var it = current();
    if (!it || !mode) return;
    ll = round3(ll);
    if (mode === "pos") {
      it.pos = ll;
      setMode(null);
      saveDraft();
      return;
    }
    draft.push(ll);
    map.showDraft(draft, mode === "poly");
    render();
  }

  function finishDraw() {
    var it = current();
    if (!it) return setMode(null);
    if (mode === "line" && draft.length >= 2) {
      it.shape = { type: "LineString", coordinates: draft.slice() };
    } else if (mode === "poly" && draft.length >= 3) {
      var ring = draft.concat([draft[0]]);
      // d3 vill ha medurs ring; om ytan blev "hela jorden utom" vänder vi den
      if (d3.geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
      it.shape = { type: "Polygon", coordinates: [ring] };
    } else {
      alert(mode === "line" ? "Klicka minst 2 punkter." : "Klicka minst 3 punkter.");
      return;
    }
    if (!it.pos || (it.pos[0] === 0 && it.pos[1] === 0)) {
      var c = d3.geoCentroid(it.shape);
      it.pos = round3(mode === "line" ? draft[Math.floor(draft.length / 2)] : c);
    }
    setMode(null);
    saveDraft();
  }

  /* ---------- panel ---------- */
  function render() {
    if (!list) return;
    var it = current();
    var html = "";
    html += '<div class="row wrap" style="margin-top:0"><select id="pick">';
    lists.forEach(function (l, i) {
      html += '<option value="' + i + '"' + (l.id === list.id ? " selected" : "") + ">" + P.esc(l.title) + "</option>";
    });
    if (!lists.some(function (l) { return l.id === list.id; })) html += '<option selected>' + P.esc(list.title) + " (ny)</option>";
    html += '</select><button class="btn small" id="new-list">+ Ny lista</button>' +
      '<label class="btn small ghost">Öppna fil…<input type="file" id="open-file" accept=".json" hidden></label></div>';

    html += '<details class="edit-box"' + (list.items.length ? "" : " open") + "><summary><b>Om listan</b></summary>" +
      '<label class="f">Titel</label><input type="text" id="l-title" value="' + P.esc(list.title) + '">' +
      '<label class="f">Ämne</label><input type="text" id="l-subject" value="' + P.esc(list.subject) + '">' +
      '<label class="f">Avsnitt (t.ex. Europa, Asien)</label><input type="text" id="l-section" value="' + P.esc(list.section) + '">' +
      '<label class="f">Filnamn/id (bara a–z, 0–9 och -)</label><input type="text" id="l-id" value="' + P.esc(list.id) + '">' +
      '<label class="f">Kartstil</label><select id="l-style"><option value="political"' + (list.style === "political" ? " selected" : "") +
      '>Länder i färger</option><option value="physical"' + (list.style === "physical" ? " selected" : "") + ">Berg och vatten</option></select>" +
      '<label class="f">Grupper (en per rad: id = rubrik)</label><textarea id="l-groups" rows="3">' +
      P.esc(list.groups.map(function (g) { return g.id + " = " + g.title; }).join("\n")) + "</textarea>" +
      '<div class="row"><button class="btn small" id="set-view">Använd nuvarande kartvy som start</button></div>' +
      '<p class="small muted">Startvy: ' + JSON.stringify(list.view) + "</p></details>";

    html += '<div class="row" style="justify-content:space-between"><b>Platser (' + list.items.length + ')</b>' +
      '<button class="btn small primary" id="add">+ Ny plats</button></div><ul class="edit-items">';
    list.items.slice().sort(P.byLabel).forEach(function (x) {
      html += '<li data-id="' + P.esc(x.id) + '" class="' + (x.id === sel ? "sel" : "") + '"><span class="num">' + P.esc(x.label || "") +
        "</span>" + P.esc(x.name) + '<span class="geo">' + (x.shape ? (/Line/.test(x.shape.type) ? "linje" : "yta") : "punkt") + "</span></li>";
    });
    html += "</ul>";

    if (it) {
      html += '<div class="edit-box"><b>Ändra: ' + P.esc(it.name) + "</b>" +
        '<label class="f">Namn (rätt svar)</label><input type="text" id="i-name" value="' + P.esc(it.name) + '">' +
        '<label class="f">Godkänn också (kommaseparerat)</label><input type="text" id="i-aliases" value="' + P.esc((it.aliases || []).join(", ")) + '">' +
        '<label class="f">Nummer/bokstav på kartan</label><input type="text" id="i-label" value="' + P.esc(it.label || "") + '">' +
        '<label class="f">Grupp</label><select id="i-group">' +
        list.groups.map(function (g) { return '<option value="' + P.esc(g.id) + '"' + (g.id === it.group ? " selected" : "") + ">" + P.esc(g.title) + "</option>"; }).join("") +
        "</select>" +
        '<label class="f">Typ</label><select id="i-type">' +
        TYPES.map(function (t) { return '<option value="' + t + '"' + (t === it.type ? " selected" : "") + ">" + P.TYPE_NAMES[t] + "</option>"; }).join("") +
        "</select>" +
        '<label class="f">Ledtråd (valfri, visas i "Hitta på kartan")</label><input type="text" id="i-hint" value="' + P.esc(it.hint || "") + '">' +
        '<p class="small muted">Position: ' + (it.pos ? it.pos.join(", ") : "–") + " · Form: " + (it.shape ? it.shape.type : "ingen (punkt)") + "</p>";
      if (mode === "line" || mode === "poly") {
        html += '<div class="row wrap"><button class="btn small primary" id="d-done">Klar (' + draft.length + ' punkter)</button>' +
          '<button class="btn small" id="d-undo">Ångra punkt</button><button class="btn small ghost" id="d-cancel">Avbryt</button></div>';
      } else if (mode === "pos") {
        html += '<div class="row"><button class="btn small ghost" id="d-cancel">Avbryt</button></div>';
      } else {
        html += '<div class="row wrap"><button class="btn small" id="m-pos">📍 Sätt position</button>' +
          '<button class="btn small" id="m-line">〰️ Rita linje</button>' +
          '<button class="btn small" id="m-poly">⬠ Rita yta</button>' +
          (it.shape ? '<button class="btn small ghost" id="m-noshape">Ta bort form</button>' : "") + "</div>" +
          '<div class="row"><button class="btn small ghost danger" id="del">Ta bort platsen</button></div>';
      }
      html += "</div>";
    }

    html += '<div class="edit-box"><b>Spara</b><p class="small">Ladda ner filen och lägg den i mappen <code>data/lists/</code> ' +
      "(ersätt den gamla). För en ny lista: lägg också till filnamnet i <code>data/lists/index.json</code>.</p>" +
      '<div class="row wrap"><button class="btn primary" id="download">⬇ Ladda ner ' + P.esc(list.id) + '.json</button>' +
      '<button class="btn small" id="copy">Kopiera</button>' +
      '<button class="btn small ghost" id="dl-index">⬇ index.json</button></div>' +
      (dirty ? '<p class="small warn">Du har ändringar som inte är nedladdade än (de sparas tillfälligt i webbläsaren).</p>' : "") +
      "</div>";
    panel.innerHTML = html;
    bind(it);
  }

  function bind(it) {
    $("#pick").onchange = function () {
      var l = lists[+this.value];
      if (l) loadList(l);
    };
    $("#new-list").onclick = function () {
      list = newList();
      sel = null;
      buildMap();
      render();
    };
    $("#open-file").onchange = function () {
      var f = this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { loadList(JSON.parse(r.result)); } catch (e) { alert("Kunde inte läsa filen: " + e.message); }
      };
      r.readAsText(f);
    };
    function bindField(id, fn) {
      var el = $(id);
      if (el) el.onchange = function () { fn(el.value); saveDraft(); refreshMap(); render(); };
    }
    bindField("#l-title", function (v) { list.title = v.trim(); });
    bindField("#l-subject", function (v) { list.subject = v.trim(); });
    bindField("#l-section", function (v) { list.section = v.trim(); });
    bindField("#l-id", function (v) { localStorage.removeItem(draftKey()); list.id = slug(v); });
    bindField("#l-style", function (v) { list.style = v; buildMap(); });
    bindField("#l-groups", function (v) {
      var gs = v.split("\n").map(function (line) {
        var m = line.split("=");
        var gid = slug(m[0]);
        return m[0].trim() ? { id: gid, title: (m[1] || m[0]).trim() } : null;
      }).filter(Boolean);
      if (gs.length) list.groups = gs;
    });
    $("#set-view").onclick = function () { list.view = map.currentView(); saveDraft(); render(); };
    $("#add").onclick = function () {
      var name = prompt("Vad heter platsen?");
      if (!name) return;
      var id = slug(name), n = 2;
      while (list.items.some(function (x) { return x.id === id; })) id = slug(name) + "-" + n++;
      var nums = list.items.map(function (x) { return parseInt(x.label, 10); }).filter(isFinite);
      list.items.push({
        id: id, label: String((nums.length ? Math.max.apply(null, nums) : 0) + 1), name: name.trim(), aliases: [],
        group: list.groups[0].id, type: "place", pos: [0, 0],
      });
      sel = id;
      saveDraft();
      setMode("pos");
    };
    $all(".edit-items li").forEach(function (li) {
      li.onclick = function () {
        sel = li.getAttribute("data-id");
        setMode(null);
        var x = current();
        if (x && x.pos) map.focusOn(x.pos, map.transform.k);
      };
    });
    if (it) {
      bindField("#i-name", function (v) { it.name = v.trim(); });
      bindField("#i-aliases", function (v) { it.aliases = v.split(",").map(function (s) { return s.trim(); }).filter(Boolean); });
      bindField("#i-label", function (v) { it.label = v.trim(); });
      bindField("#i-group", function (v) { it.group = v; });
      bindField("#i-type", function (v) { it.type = v; });
      bindField("#i-hint", function (v) { if (v.trim()) it.hint = v.trim(); else delete it.hint; });
      var b;
      if ((b = $("#m-pos"))) b.onclick = function () { setMode("pos"); };
      if ((b = $("#m-line"))) b.onclick = function () { setMode("line"); };
      if ((b = $("#m-poly"))) b.onclick = function () { setMode("poly"); };
      if ((b = $("#m-noshape"))) b.onclick = function () { delete it.shape; saveDraft(); refreshMap(); render(); };
      if ((b = $("#d-done"))) b.onclick = finishDraw;
      if ((b = $("#d-undo"))) b.onclick = function () { draft.pop(); map.showDraft(draft, mode === "poly"); render(); };
      if ((b = $("#d-cancel"))) b.onclick = function () { setMode(null); };
      if ((b = $("#del"))) b.onclick = function () {
        if (!confirm("Ta bort " + it.name + "?")) return;
        list.items = list.items.filter(function (x) { return x.id !== it.id; });
        sel = null;
        saveDraft();
        refreshMap();
        render();
      };
    }
    $("#download").onclick = function () {
      download(list.id + ".json", JSON.stringify(list, null, 1));
      dirty = false;
      try { localStorage.removeItem(draftKey()); } catch (e) {}
      render();
    };
    $("#copy").onclick = function () {
      var txt = JSON.stringify(list, null, 1);
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { alert("Kopierat!"); });
      else prompt("Kopiera texten:", txt);
    };
    $("#dl-index").onclick = function () {
      var files = lists.map(function (l) { return l.file; });
      if (files.indexOf(list.id + ".json") < 0) files.push(list.id + ".json");
      download("index.json", JSON.stringify({ lists: files }, null, 2) + "\n");
    };
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  Promise.all([P.loadLists(), P.loadBase()]).then(function (r) {
    lists = r[0];
    base = r[1];
    loadList(lists[0] || newList());
  }).catch(function (e) {
    panel.innerHTML = '<p class="warn">Fel: ' + P.esc(e.message) + "</p>";
  });
})();
