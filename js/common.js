/* Gemensamma hjälpfunktioner: laddning, rättning, avstånd, sparade resultat. */
(function () {
  "use strict";
  var P = (window.P = window.P || {});

  P.loadJSON = function (url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Kunde inte läsa " + url + " (" + r.status + ")");
      return r.json();
    });
  };

  var listCache = {};
  P.loadLists = function () {
    return P.loadJSON("data/lists/index.json").then(function (idx) {
      return Promise.all(
        idx.lists.map(function (file) {
          if (listCache[file]) return listCache[file];
          return (listCache[file] = P.loadJSON("data/lists/" + file).then(function (l) {
            l.file = file;
            return l;
          }));
        })
      );
    });
  };

  var basePromise = null;
  P.loadBase = function () {
    return basePromise || (basePromise = P.loadJSON("data/base/world.json"));
  };

  P.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  P.shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  /* Sortering av etiketter: siffror numeriskt, bokstäver i svensk ordning. */
  var ALPHA = "abcdefghijklmnopqrstuvwxyzåäö";
  P.labelKey = function (l) {
    l = String(l).toLowerCase();
    if (/^\d+$/.test(l)) return [0, parseInt(l, 10)];
    var k = 0;
    for (var i = 0; i < l.length; i++) k = k * 40 + (ALPHA.indexOf(l[i]) + 1);
    return [1, k];
  };
  P.byLabel = function (a, b) {
    var x = P.labelKey(a.label),
      y = P.labelKey(b.label);
    return x[0] - y[0] || x[1] - y[1];
  };

  /* ---------- Rättning av skrivna svar ---------- */
  P.normalize = function (s) {
    s = String(s || "").toLowerCase().trim();
    s = s.replace(/å/g, "\u0001").replace(/ä/g, "\u0002").replace(/ö/g, "\u0003");
    s = s.replace(/ø/g, "\u0003").replace(/æ/g, "\u0002").replace(/ł/g, "l");
    if (s.normalize) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    s = s.replace(/\u0001/g, "å").replace(/\u0002/g, "ä").replace(/\u0003/g, "ö");
    s = s.replace(/[-–_.,!?'"()]/g, " ").replace(/\s+/g, " ").trim();
    return s;
  };

  P.levenshtein = function (a, b) {
    if (a === b) return 0;
    var m = a.length,
      n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = [],
      cur = [];
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  };

  /** Returnerar "correct", "close" (litet stavfel, räknas som rätt) eller "wrong". */
  P.checkAnswer = function (answer, item) {
    var a = P.normalize(answer);
    if (!a) return "wrong";
    var targets = [item.name].concat(item.aliases || []);
    var best = "wrong";
    for (var i = 0; i < targets.length; i++) {
      var t = P.normalize(targets[i]);
      if (a === t || a.replace(/ /g, "") === t.replace(/ /g, "")) return "correct";
      var allowed = t.length <= 4 ? 0 : t.length <= 7 ? 1 : 2;
      if (P.levenshtein(a, t) <= allowed) best = "close";
    }
    return best;
  };

  /* ---------- Avstånd på kartan ---------- */
  var R = 6371;
  P.haversine = function (a, b) {
    var toR = Math.PI / 180;
    var dLat = (b[1] - a[1]) * toR,
      dLon = (b[0] - a[0]) * toR;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  function lines(geom) {
    var out = [];
    if (!geom) return out;
    var c = geom.coordinates;
    switch (geom.type) {
      case "LineString":
        out.push(c);
        break;
      case "MultiLineString":
      case "Polygon":
        c.forEach(function (l) { out.push(l); });
        break;
      case "MultiPolygon":
        c.forEach(function (p) { p.forEach(function (l) { out.push(l); }); });
        break;
      case "Point":
        out.push([c]);
        break;
      case "MultiPoint":
        c.forEach(function (p) { out.push([p]); });
        break;
    }
    return out;
  }

  P.itemGeometry = function (item) {
    return item.shape || { type: "Point", coordinates: item.pos };
  };

  /**
   * Avstånd i km från en punkt [lon,lat] till platsens form.
   * Returnerar {km, nearest:[lon,lat]}. Inuti en yta = 0 km.
   */
  P.distanceToItem = function (p, item) {
    var geom = P.itemGeometry(item);
    if ((geom.type === "Polygon" || geom.type === "MultiPolygon") &&
        d3.geoContains({ type: "Feature", geometry: geom }, p)) {
      return { km: 0, nearest: p };
    }
    var cos = Math.cos((p[1] * Math.PI) / 180);
    function xy(q) {
      var dl = q[0] - p[0];
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      return [dl * cos * 111.32, (q[1] - p[1]) * 110.57];
    }
    var best = Infinity,
      bestPt = item.pos;
    lines(geom).forEach(function (line) {
      for (var i = 0; i < line.length; i++) {
        var a = xy(line[i]);
        var cand = a,
          cq = line[i];
        if (i + 1 < line.length) {
          var b = xy(line[i + 1]);
          var dx = b[0] - a[0],
            dy = b[1] - a[1];
          var L = dx * dx + dy * dy;
          var t = L ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / L)) : 0;
          cand = [a[0] + t * dx, a[1] + t * dy];
          cq = [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])];
        }
        var d = Math.sqrt(cand[0] * cand[0] + cand[1] * cand[1]);
        if (d < best) {
          best = d;
          bestPt = cq;
        }
      }
    });
    // Exaktare avstånd till den närmaste punkten
    return { km: P.haversine(p, bestPt), nearest: bestPt };
  };

  P.TYPE_NAMES = {
    country: "land",
    capital: "huvudstad",
    city: "stad",
    range: "bergskedja",
    peak: "bergstopp",
    sea: "hav",
    ocean: "ocean",
    lake: "sjö",
    river: "flod",
    island: "ö",
    place: "plats",
  };

  /* ---------- Sparade resultat (localStorage, bara på den här enheten) ---------- */
  var KEY = "plugga.v1";
  function read() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.profiles) return s;
    } catch (e) {}
    return { profiles: [], current: null, results: {}, sessions: [] };
  }
  function write(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }
  P.store = {
    get: read,
    profile: function () {
      var s = read();
      for (var i = 0; i < s.profiles.length; i++) if (s.profiles[i].id === s.current) return s.profiles[i];
      return null;
    },
    addProfile: function (name) {
      var s = read();
      var id = "p" + Date.now().toString(36);
      s.profiles.push({ id: id, name: name });
      s.current = id;
      write(s);
      return id;
    },
    setProfile: function (id) {
      var s = read();
      s.current = id;
      write(s);
    },
    removeProfile: function (id) {
      var s = read();
      s.profiles = s.profiles.filter(function (p) { return p.id !== id; });
      delete s.results[id];
      s.sessions = s.sessions.filter(function (x) { return x.profile !== id; });
      if (s.current === id) s.current = s.profiles.length ? s.profiles[0].id : null;
      write(s);
    },
    /** Sparar resultat för en plats. ok = true/false. */
    record: function (listId, itemId, ok) {
      var s = read();
      var pid = s.current || "anon";
      var r = (s.results[pid] = s.results[pid] || {});
      var l = (r[listId] = r[listId] || {});
      var it = (l[itemId] = l[itemId] || { n: 0, ok: 0, last: [] });
      it.n++;
      if (ok) it.ok++;
      it.last = (it.last || []).concat(ok ? 1 : 0).slice(-5);
      it.t = Date.now();
      write(s);
    },
    session: function (listId, mode, score, total) {
      var s = read();
      s.sessions.push({ profile: s.current || "anon", list: listId, mode: mode, score: score, total: total, t: Date.now() });
      if (s.sessions.length > 500) s.sessions = s.sessions.slice(-500);
      write(s);
    },
    results: function (listId) {
      var s = read();
      var r = s.results[s.current || "anon"] || {};
      return r[listId] || {};
    },
    sessions: function () {
      var s = read();
      var pid = s.current || "anon";
      return s.sessions.filter(function (x) { return x.profile === pid; });
    },
    pref: function (k, v) {
      var s = read();
      s.prefs = s.prefs || {};
      if (v === undefined) return s.prefs[k];
      s.prefs[k] = v;
      write(s);
    },
  };

  /** Hur väl kan man platsen? 0..1 utifrån de senaste försöken, null om aldrig övat. */
  P.mastery = function (r) {
    if (!r || !r.n) return null;
    var last = r.last || [];
    if (!last.length) return r.ok / r.n;
    var sum = 0,
      w = 0;
    for (var i = 0; i < last.length; i++) {
      var wt = i + 1;
      sum += last[i] * wt;
      w += wt;
    }
    return sum / w;
  };
})();
