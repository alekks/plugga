/* Kartvy: ritar grundkartan, hanterar zoom (mus, styrplatta, nyp på iPad) och markörer. */
(function () {
  "use strict";
  var P = (window.P = window.P || {});

  var PALETTE = ["#f3d9a4", "#cfe3b5", "#f2c6c2", "#d9cdea", "#f6e6a0", "#c3dde9", "#e9cfb2"];
  var BUBBLE_R = 12;

  function viewOutline(view) {
    var w = view[0][0], s = view[0][1], e = view[1][0], n = view[1][1];
    var pts = [], i, N = 16;
    for (i = 0; i <= N; i++) pts.push([w + ((e - w) * i) / N, s]);
    for (i = 0; i <= N; i++) pts.push([e, s + ((n - s) * i) / N]);
    for (i = 0; i <= N; i++) pts.push([e - ((e - w) * i) / N, n]);
    for (i = 0; i <= N; i++) pts.push([w, n - ((n - s) * i) / N]);
    return { type: "MultiPoint", coordinates: pts };
  }

  /**
   * new P.MapView(element, base, {view, style, onClick(lonlat), onMarker(id)})
   */
  function MapView(el, base, opts) {
    var self = this;
    this.el = el;
    this.base = base;
    this.opts = opts || {};
    this.view = this.opts.view || [[-25, 34], [60, 71]];
    this.markers = [];
    this.transform = d3.zoomIdentity;

    el.classList.remove("map-political", "map-physical");
    el.classList.add("map", "map-" + (this.opts.style || "political"));
    el.innerHTML =
      '<svg class="map-svg"></svg>' +
      '<div class="map-tools">' +
      '<button type="button" data-z="in" title="Zooma in">+</button>' +
      '<button type="button" data-z="out" title="Zooma ut">−</button>' +
      '<button type="button" data-z="reset" title="Hela kartan">⤢</button>' +
      "</div>";
    this.svg = d3.select(el).select("svg");
    this.root = this.svg.append("g").attr("class", "zoom-root");
    this.gSphere = this.root.append("path").attr("class", "sphere");
    this.gCountries = this.root.append("g").attr("class", "countries");
    this.gRanges = this.root.append("g").attr("class", "ranges");
    this.gLakes = this.root.append("g").attr("class", "lakes");
    this.gRivers = this.root.append("g").attr("class", "rivers");
    this.gShapes = this.root.append("g").attr("class", "shapes");
    this.gLines = this.root.append("g").attr("class", "answer-lines");
    this.gPoints = this.root.append("g").attr("class", "shape-points");
    this.gMarkers = this.root.append("g").attr("class", "markers");
    this.gDraft = this.root.append("g").attr("class", "draft");

    var cx = (this.view[0][0] + this.view[1][0]) / 2;
    var cy = (this.view[0][1] + this.view[1][1]) / 2;
    this.projection = d3.geoAzimuthalEqualArea().rotate([-cx, -cy]).clipAngle(90).precision(0.3);
    this.path = d3.geoPath(this.projection);

    this.zoom = d3
      .zoom()
      .scaleExtent([0.7, 60])
      .clickDistance(8)
      .tapDistance(12)
      .on("zoom", function (ev) {
        self.transform = ev.transform;
        self.root.attr("transform", ev.transform);
        self._scaleMarkers();
      })
      .on("end", function () {
        self._declutter();
      });
    this.svg.call(this.zoom);
    if (this.opts.noDblZoom) this.svg.on("dblclick.zoom", null);

    this.svg.on("click", function (ev) {
      if (ev.defaultPrevented) return;
      var ll = self.eventLonLat(ev);
      if (ll && self.opts.onClick) self.opts.onClick(ll, ev);
    });

    d3.select(el).selectAll(".map-tools button").on("click", function (ev) {
      ev.stopPropagation();
      var z = this.getAttribute("data-z");
      var t = self.svg.transition().duration(300);
      if (z === "in") self.zoom.scaleBy(t, 1.6);
      else if (z === "out") self.zoom.scaleBy(t, 1 / 1.6);
      else self.zoom.transform(t, d3.zoomIdentity);
    });

    this._lastSize = [0, 0];
    this.resize(true);
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(el);
    } else {
      this._onResize = function () { self.resize(); };
      window.addEventListener("resize", this._onResize);
    }
  }

  MapView.prototype.destroy = function () {
    if (this._ro) this._ro.disconnect();
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  };

  MapView.prototype.resize = function (force) {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    // Ignorera små höjdändringar (t.ex. adressfält eller tangentbord på iPad)
    if (!force && Math.abs(w - this._lastSize[0]) < 3 && Math.abs(h - this._lastSize[1]) < 120) return;
    this._lastSize = [w, h];
    this.width = w;
    this.height = h;
    this.svg.attr("width", w).attr("height", h);
    this.projection.fitExtent([[8, 8], [w - 8, h - 8]], viewOutline(this.view));
    this.zoom.extent([[0, 0], [w, h]]).translateExtent([[-w * 0.6, -h * 0.6], [w * 1.6, h * 1.6]]);
    this.render();
  };

  MapView.prototype.render = function () {
    var path = this.path, b = this.base;
    this.gSphere.attr("d", path({ type: "Sphere" }));
    this.gCountries
      .selectAll("path")
      .data(b.countries.features)
      .join("path")
      .attr("d", path)
      .attr("fill", function (d) { return PALETTE[((d.properties.c || 1) - 1) % PALETTE.length]; });
    this.gRanges.selectAll("path").data(b.ranges.features).join("path").attr("d", path);
    this.gLakes.selectAll("path").data(b.lakes.features).join("path").attr("d", path);
    this.gRivers
      .selectAll("path")
      .data(b.rivers.features)
      .join("path")
      .attr("d", path)
      .attr("class", function (d) { return "r" + Math.min(d.properties.r || 5, 9); });
    this._renderShapes();
    this._renderMarkers();
  };

  /* ---------- koordinater ---------- */
  MapView.prototype.eventLonLat = function (ev) {
    var pt = d3.pointer(ev, this.svg.node());
    var inv = this.transform.invert(pt);
    return this.projection.invert(inv);
  };
  MapView.prototype.project = function (lonlat) {
    return this.projection(lonlat);
  };

  /* ---------- former (svar, markeringar) ---------- */
  MapView.prototype.clearShapes = function () {
    this._shapes = [];
    this._lines = [];
    this._renderShapes();
  };
  /** Visar en plats form. cls t.ex. "hl" (markerad), "correct", "wrong". */
  MapView.prototype.showShape = function (item, cls) {
    this._shapes = (this._shapes || []).filter(function (s) { return s.item.id !== item.id; });
    this._shapes.push({ item: item, cls: cls || "hl" });
    this._renderShapes();
  };
  MapView.prototype.hideShape = function (item) {
    this._shapes = (this._shapes || []).filter(function (s) { return s.item.id !== item.id; });
    this._renderShapes();
  };
  MapView.prototype.showLine = function (a, b, cls) {
    this._lines = (this._lines || []).concat([{ a: a, b: b, cls: cls || "" }]);
    this._renderShapes();
  };
  MapView.prototype.showPin = function (lonlat, cls) {
    this._pins = (this._pins || []).concat([{ p: lonlat, cls: cls || "" }]);
    this._renderShapes();
  };
  MapView.prototype.clearPins = function () {
    this._pins = [];
    this._renderShapes();
  };

  MapView.prototype._renderShapes = function () {
    var self = this, path = this.path;
    var shapes = this._shapes || [];
    var area = shapes.filter(function (s) { return s.item.shape; });
    this.gShapes
      .selectAll("path")
      .data(area, function (s) { return s.item.id; })
      .join("path")
      .attr("class", function (s) {
        var t = s.item.shape.type;
        var kind = /Line/.test(t) ? "line" : "area";
        return "shape " + kind + " " + s.cls;
      })
      .attr("d", function (s) { return path(s.item.shape); });

    this.gLines
      .selectAll("path")
      .data(this._lines || [])
      .join("path")
      .attr("class", function (l) { return "answer-line " + l.cls; })
      .attr("d", function (l) { return path({ type: "LineString", coordinates: [l.a, l.b] }); });

    var pts = shapes
      .filter(function (s) { return !s.item.shape; })
      .map(function (s) { return { p: s.item.pos, cls: "target " + s.cls }; })
      .concat(this._pins || []);
    var sel = this.gPoints
      .selectAll("g.pt")
      .data(pts)
      .join(function (enter) {
        var g = enter.append("g").attr("class", "pt");
        g.append("circle").attr("class", "halo").attr("r", 14);
        g.append("circle").attr("class", "dot").attr("r", 5);
        return g;
      });
    sel
      .attr("class", function (d) { return "pt " + d.cls; })
      .attr("data-x", function (d) { var q = self.projection(d.p); return q ? q[0] : -9999; })
      .attr("data-y", function (d) { var q = self.projection(d.p); return q ? q[1] : -9999; });
    this._scaleMarkers();
  };

  /* ---------- markörer (bubblor med nummer/text) ---------- */
  /**
   * markers: [{id, pos, text, cls, point:true/false}]
   * point = exakt plats (huvudstad, bergstopp): liten prick + bubbla bredvid.
   */
  MapView.prototype.setMarkers = function (markers) {
    this.markers = markers.map(function (m) {
      return Object.assign({ ox: m.point ? 0 : 0, oy: m.point ? -20 : 0 }, m);
    });
    this._renderMarkers();
  };
  MapView.prototype.updateMarker = function (id, props) {
    for (var i = 0; i < this.markers.length; i++) {
      if (this.markers[i].id === id) Object.assign(this.markers[i], props);
    }
    this._renderMarkers(true);
  };
  MapView.prototype.updateAll = function (fn) {
    this.markers.forEach(function (m) { Object.assign(m, fn(m) || {}); });
    this._renderMarkers(true);
  };

  MapView.prototype._renderMarkers = function (noDeclutter) {
    var self = this;
    var sel = this.gMarkers
      .selectAll("g.mk")
      .data(this.markers, function (m) { return m.id; })
      .join(function (enter) {
        var g = enter.append("g").attr("class", "mk");
        var inner = g.append("g").attr("class", "mk-inner");
        inner.append("line").attr("class", "leader");
        inner.append("path").attr("class", "pin");
        var b = inner.append("g").attr("class", "bubble");
        b.append("circle").attr("r", BUBBLE_R);
        b.append("text").attr("dy", "0.36em");
        g.on("click", function (ev, m) {
          ev.stopPropagation();
          if (self.opts.onMarker) self.opts.onMarker(m.id, ev);
        });
        return g;
      });
    sel.each(function (m) {
      var q = self.projection(m.pos);
      m.x = q ? q[0] : -9999;
      m.y = q ? q[1] : -9999;
    });
    sel.attr("class", function (m) { return "mk " + (m.point ? "is-point " : "") + (m.cls || ""); });
    sel.select(".pin").attr("d", function (m) {
      if (!m.point) return "";
      if (m.pinShape === "triangle") return "M0,-6L5.5,4L-5.5,4Z";
      return "M-3.5,0a3.5,3.5 0 1,0 7,0a3.5,3.5 0 1,0 -7,0";
    });
    sel.select("text").text(function (m) { return m.text == null ? "" : m.text; });
    sel.select("circle").attr("r", function (m) {
      var len = String(m.text == null ? "" : m.text).length;
      return len > 2 ? BUBBLE_R + (len - 2) * 3.5 : BUBBLE_R;
    });
    this._scaleMarkers();
    if (!noDeclutter) this._declutter();
  };

  MapView.prototype._scaleMarkers = function () {
    var k = this.transform.k;
    this.gMarkers.selectAll("g.mk").attr("transform", function (m) {
      return "translate(" + m.x + "," + m.y + ") scale(" + 1 / k + ")";
    });
    this.gPoints.selectAll("g.pt").attr("transform", function () {
      return "translate(" + this.getAttribute("data-x") + "," + this.getAttribute("data-y") + ") scale(" + 1 / k + ")";
    });
    this.gDraft.selectAll(".draft-pt").attr("r", 5 / k);
  };

  /** Flyttar isär bubblor som krockar och drar en tunn linje till rätt plats. */
  MapView.prototype._declutter = function () {
    var t = this.transform;
    var nodes = this.markers
      .filter(function (m) { return m.x > -9000; })
      .map(function (m) {
        var ax = t.applyX(m.x), ay = t.applyY(m.y);
        var len = String(m.text == null ? "" : m.text).length;
        var r = (len > 2 ? BUBBLE_R + (len - 2) * 3.5 : BUBBLE_R) + 1.5;
        var pref = m.point ? -20 : 0;
        return { m: m, ax: ax, ay: ay + pref, x: ax + (m.ox || 0), y: ay + (m.oy || 0), r: r, ay0: ay };
      });
    if (nodes.length > 1) {
      var sim = d3
        .forceSimulation(nodes)
        .force("x", d3.forceX(function (d) { return d.ax; }).strength(0.2))
        .force("y", d3.forceY(function (d) { return d.ay; }).strength(0.2))
        .force("c", d3.forceCollide(function (d) { return d.r; }).strength(0.9).iterations(3))
        .stop();
      for (var i = 0; i < 160; i++) sim.tick();
    }
    nodes.forEach(function (n) {
      n.m.ox = n.x - n.ax;
      n.m.oy = n.y - n.ay0;
    });
    this.gMarkers.selectAll("g.mk").each(function (m) {
      var g = d3.select(this);
      var ox = m.ox || 0, oy = m.oy || 0;
      g.select(".bubble").attr("transform", "translate(" + ox + "," + oy + ")");
      var far = Math.sqrt(ox * ox + oy * oy) > BUBBLE_R * 0.9;
      g.select(".leader")
        .attr("x1", 0).attr("y1", 0).attr("x2", ox).attr("y2", oy)
        .style("display", far ? null : "none");
    });
  };

  MapView.prototype.focusOn = function (lonlat, k) {
    var q = this.projection(lonlat);
    if (!q) return;
    k = k || Math.max(this.transform.k, 3);
    var t = d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(k).translate(-q[0], -q[1]);
    this.svg.transition().duration(500).call(this.zoom.transform, t);
  };

  /** Zoomar så att alla positioner syns. */
  MapView.prototype.fitPoints = function (points) {
    var self = this;
    var q = points.map(function (p) { return self.projection(p); }).filter(Boolean);
    if (!q.length) return;
    var x0 = d3.min(q, function (d) { return d[0]; }), x1 = d3.max(q, function (d) { return d[0]; });
    var y0 = d3.min(q, function (d) { return d[1]; }), y1 = d3.max(q, function (d) { return d[1]; });
    var pad = 60;
    var k = Math.min(8, (this.width - pad * 2) / Math.max(x1 - x0, 1), (this.height - pad * 2) / Math.max(y1 - y0, 1));
    k = Math.max(1, k);
    var t = d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    this.svg.transition().duration(500).call(this.zoom.transform, t);
  };

  /* ---------- utkast i redigeringsläget ---------- */
  MapView.prototype.showDraft = function (coords, closed) {
    var path = this.path, self = this;
    var g = this.gDraft;
    g.selectAll("path")
      .data(coords.length > 1 ? [coords] : [])
      .join("path")
      .attr("class", "draft-line")
      .attr("d", function (c) {
        return path({ type: "LineString", coordinates: closed ? c.concat([c[0]]) : c });
      });
    g.selectAll("circle")
      .data(coords)
      .join("circle")
      .attr("class", "draft-pt")
      .attr("cx", function (c) { return self.projection(c)[0]; })
      .attr("cy", function (c) { return self.projection(c)[1]; })
      .attr("r", 5 / this.transform.k);
  };

  MapView.prototype.currentView = function () {
    // Ungefärlig lon/lat-ruta för det som syns nu
    var w = this.width, h = this.height, t = this.transform, pr = this.projection;
    var pts = [];
    for (var i = 0; i <= 10; i++) {
      pts.push([(w * i) / 10, 0], [(w * i) / 10, h], [0, (h * i) / 10], [w, (h * i) / 10]);
    }
    var ll = pts.map(function (p) { return pr.invert(t.invert(p)); }).filter(function (p) { return p && isFinite(p[0]); });
    var r = function (v) { return Math.round(v * 10) / 10; };
    return [
      [r(d3.min(ll, function (p) { return p[0]; })), r(d3.min(ll, function (p) { return p[1]; }))],
      [r(d3.max(ll, function (p) { return p[0]; })), r(d3.max(ll, function (p) { return p[1]; }))],
    ];
  };

  P.MapView = MapView;
})();
