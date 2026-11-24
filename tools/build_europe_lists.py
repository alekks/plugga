#!/usr/bin/env python3
"""
Engangsskript som skapade de tre Europa-listorna i data/lists/ med former
(lander, floder, hav, bergskedjor) fran Natural Earth.

OBS: Skriver over listorna! Kor bara med --force om du vet vad du gor.
Nya listor (t.ex. Asien) gors enklast i redigeringssidan (edit.html).

Kor: python3 tools/build_europe_lists.py <natural-earth-mapp> --force
"""
import json
import os
import sys

from shapely.geometry import shape, mapping, Point, box
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, linemerge, nearest_points

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "..", "data", "lists")
EUROPE_VIEW = [[-24, 34], [60, 71.5]]
CLIP = box(-35, 25, 75, 85)


def rnd(obj, nd=3):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [rnd(o, nd) for o in obj]
    return obj


def d3_orient(g):
    if isinstance(g, Polygon):
        return orient(g, sign=-1.0)
    if isinstance(g, MultiPolygon):
        return MultiPolygon([orient(p, sign=-1.0) for p in g.geoms])
    return g


def geo(g, tol=0.02, nd=3):
    g = g.intersection(CLIP)
    s = g.simplify(tol, preserve_topology=True)
    if s.is_empty:
        s = g
    if s.geom_type == "GeometryCollection":
        polys = [x for x in s.geoms if x.geom_type in ("Polygon", "MultiPolygon")]
        s = unary_union(polys)
    s = d3_orient(s)
    m = mapping(s)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"], nd)}


def load(src, name):
    with open(os.path.join(src, name)) as f:
        return json.load(f)["features"]


def main(src):
    countries = {f["properties"]["ADM0_A3"]: shape(f["geometry"])
                 for f in load(src, "ne_50m_admin_0_countries.geojson")}
    marine = {}
    for f in load(src, "ne_10m_geography_marine_polys.geojson"):
        n = f["properties"].get("name")
        if n:
            marine.setdefault(n, []).append(shape(f["geometry"]))
    regions = {}
    for f in load(src, "ne_10m_geography_regions_polys.geojson"):
        p = f["properties"]
        if p.get("FEATURECLA") == "Range/mtn":
            regions[p["NAME"]] = shape(f["geometry"])
    rivers = {}
    for f in load(src, "ne_10m_rivers_lake_centerlines.geojson"):
        n = f["properties"].get("name")
        g = shape(f["geometry"])
        if n and g.intersects(box(-12, 35, 62, 66)):
            rivers.setdefault(n, []).append(g)
    lakes = {f["properties"]["name"]: shape(f["geometry"])
             for f in load(src, "ne_10m_lakes.geojson") if f["properties"].get("name")}

    def sea(*names):
        return unary_union([g for n in names for g in marine[n]])

    def river(*names, near=None, within=None):
        parts = []
        for n in names:
            for g in rivers.get(n, []):
                if within is None or g.intersects(within):
                    parts.append(g)
        lines = []
        for p in parts:
            lines.extend(p.geoms if hasattr(p, "geoms") else [p])
        return linemerge(lines) if len(lines) > 1 else lines[0]

    def snap(g, lon, lat):
        p = nearest_points(g, Point(lon, lat))[0]
        return [round(p.x, 3), round(p.y, 3)]

    # ---------------- Lander och huvudstader ----------------
    small = [
        ("1", "Albanien", "ALB", [20.0, 41.1], []),
        ("2", "Andorra", "AND", [1.55, 42.54], []),
        ("3", "Armenien", "ARM", [44.9, 40.25], []),
        ("4", "Azerbajdzjan", "AZE", [47.6, 40.4], ["Azerbajdjan", "Azerbadjan", "Azerbajdzan"]),
        ("5", "Bosnien-Hercegovina", "BIH", [17.8, 44.2], ["Bosnien och Hercegovina", "Bosnien"]),
        ("6", "Cypern", "CYP", [33.1, 35.0], []),
        ("7", "Georgien", "GEO", [43.6, 42.2], []),
        ("8", "Kosovo", "KOS", [20.9, 42.6], []),
        ("9", "Kroatien", "HRV", [16.3, 45.5], []),
        ("10", "Liechtenstein", "LIE", [9.555, 47.14], []),
        ("11", "Luxemburg", "LUX", [6.1, 49.75], []),
        ("12", "Malta", "MLT", [14.43, 35.89], []),
        ("13", "Moldavien", "MDA", [28.5, 47.3], ["Moldova"]),
        ("14", "Monaco", "MCO", [7.42, 43.74], []),
        ("15", "Montenegro", "MNE", [19.25, 42.8], []),
        ("16", "Nordmakedonien", "MKD", [21.7, 41.6], ["Makedonien", "Norra Makedonien"]),
        ("17", "San Marino", "SMR", [12.46, 43.94], []),
        ("18", "Slovakien", "SVK", [19.5, 48.7], []),
        ("19", "Slovenien", "SVN", [14.8, 46.1], []),
        ("20", "Vatikanstaten", "VAT", [12.453, 41.904], ["Vatikanen"]),
    ]
    big = [
        ("21", "Island", "ISL", None, [], "a", "Reykjavik", [-21.94, 64.15], ["Reykjavík"]),
        ("22", "Norge", "NOR", [9.0, 61.5], [], "b", "Oslo", [10.75, 59.91], []),
        ("23", "Sverige", "SWE", [15.5, 62.5], [], "c", "Stockholm", [18.07, 59.33], []),
        ("24", "Finland", "FIN", [26.5, 63.0], [], "d", "Helsingfors", [24.94, 60.17], ["Helsinki"]),
        ("25", "Danmark", "DNK", [9.2, 56.1], [], "e", "Köpenhamn", [12.57, 55.68], []),
        ("26", "Estland", "EST", [25.8, 58.7], [], "f", "Tallinn", [24.75, 59.44], []),
        ("27", "Lettland", "LVA", [25.6, 56.85], [], "g", "Riga", [24.11, 56.95], []),
        ("28", "Litauen", "LTU", [23.9, 55.4], [], "h", "Vilnius", [25.28, 54.69], []),
        ("29", "Storbritannien", "GBR", [-1.8, 52.6], ["Förenade kungariket", "UK"], "i", "London", [-0.13, 51.51], []),
        ("30", "Irland", "IRL", [-8.0, 53.2], [], "j", "Dublin", [-6.26, 53.35], []),
        ("31", "Nederländerna", "NLD", [5.7, 52.4], ["Holland"], "k", "Amsterdam", [4.9, 52.37], ["Haag", "Den Haag"]),
        ("32", "Belgien", "BEL", [4.6, 50.6], [], "l", "Bryssel", [4.35, 50.85], ["Bruxelles", "Brussel"]),
        ("33", "Frankrike", "FRA", [2.5, 46.7], [], "m", "Paris", [2.35, 48.86], []),
        ("34", "Tyskland", "DEU", [10.2, 51.0], [], "n", "Berlin", [13.4, 52.52], []),
        ("35", "Schweiz", "CHE", [8.2, 46.8], [], "o", "Bern", [7.45, 46.95], []),
        ("36", "Österrike", "AUT", [14.5, 47.6], [], "p", "Wien", [16.37, 48.21], []),
        ("37", "Italien", "ITA", [11.5, 43.3], [], "q", "Rom", [12.5, 41.9], ["Roma"]),
        ("38", "Grekland", "GRC", [22.0, 39.5], [], "r", "Aten", [23.73, 37.98], ["Athen"]),
        ("39", "Spanien", "ESP", [-4.0, 39.6], [], "s", "Madrid", [-3.7, 40.42], []),
        ("40", "Portugal", "PRT", [-8.1, 39.8], [], "t", "Lissabon", [-9.14, 38.72], ["Lisboa"]),
        ("41", "Polen", "POL", [19.3, 52.0], [], "u", "Warszawa", [21.01, 52.23], ["Warszava", "Warschau"]),
        ("42", "Belarus", "BLR", [28.0, 53.5], ["Vitryssland"], "v", "Minsk", [27.56, 53.9], []),
        ("43", "Ryssland", "RUS", [45.0, 60.0], [], "w", "Moskva", [37.62, 55.76], []),
        ("44", "Ukraina", "UKR", [31.5, 49.0], [], "x", "Kiev", [30.52, 50.45], ["Kyiv", "Kijev"]),
        ("45", "Tjeckien", "CZE", [15.4, 49.75], ["Tjeckiska republiken"], "y", "Prag", [14.42, 50.09], ["Praha"]),
        ("46", "Ungern", "HUN", [19.4, 47.0], [], "z", "Budapest", [19.04, 47.5], []),
        ("47", "Rumänien", "ROU", [25.0, 45.9], [], "å", "Bukarest", [26.1, 44.43], []),
        ("48", "Bulgarien", "BGR", [25.2, 42.75], [], "ä", "Sofia", [23.32, 42.7], []),
        ("49", "Serbien", "SRB", [20.9, 44.0], [], "ö", "Belgrad", [20.46, 44.79], ["Beograd"]),
    ]

    def cid(name):
        t = name.lower()
        for a, b in (("å", "a"), ("ä", "a"), ("ö", "o"), (" ", "-")):
            t = t.replace(a, b)
        return t

    items = []
    for label, name, a3, pos, al in small:
        items.append({"id": cid(name), "label": label, "name": name, "aliases": al,
                      "group": "sma", "type": "country", "pos": pos,
                      "shape": geo(countries[a3], 0.01 if countries[a3].area > 0.05 else 0)})
    for label, name, a3, pos, al, clabel, cap, cpos, cal in big:
        g = countries[a3]
        if pos is None:
            c = g.representative_point()
            pos = [round(c.x, 2), round(c.y, 2)]
        items.append({"id": cid(name), "label": label, "name": name, "aliases": al,
                      "group": "lander", "type": "country", "pos": pos,
                      "shape": geo(g, 0.03)})
    for label, name, a3, pos, al, clabel, cap, cpos, cal in big:
        items.append({"id": "hs-" + cid(cap), "label": clabel, "name": cap, "aliases": cal,
                      "group": "huvudstader", "type": "capital", "pos": cpos,
                      "hint": "Huvudstad i " + name})

    write("europa-lander", {
        "id": "europa-lander",
        "title": "Länder och huvudstäder i Europa",
        "subject": "Geografi",
        "section": "Europa",
        "style": "political",
        "view": EUROPE_VIEW,
        "groups": [
            {"id": "sma", "title": "Mindre länder (1–20)"},
            {"id": "lander", "title": "Länder (21–49)"},
            {"id": "huvudstader", "title": "Huvudstäder (a–ö)"},
        ],
        "items": items,
    })

    # ---------------- Berg ----------------
    karpaterna = unary_union([regions["CARPATHIAN MOUNTAINS"], regions["Transylvanian Alps"],
                              regions["Tatra Mts."]])
    mountains = [
        ("1", "Skanderna", ["Fjällkedjan", "Skandinaviska fjällkedjan", "Kölen"], [14.0, 64.5], regions["KJØLEN MOUNTAINS"]),
        ("2", "Uralbergen", ["Ural"], [59.3, 60.0], regions["URAL MOUNTAINS"]),
        ("3", "Penninerna", ["Pennines"], [-2.15, 54.3],
         LineString([(-2.45, 55.15), (-2.35, 54.75), (-2.2, 54.3), (-2.05, 53.8), (-1.85, 53.2), (-1.75, 52.95)])),
        ("4", "Alperna", [], [10.5, 46.8], regions["ALPS"]),
        ("5", "Pyrenéerna", [], [0.6, 42.7], regions["PYRENEES"]),
        ("6", "Apenninerna", [], [13.3, 42.4], regions["APPENNINI"]),
        ("7", "Dinariska alperna", ["Dinarida alperna", "Dinariska bergen"], [17.6, 43.9], regions["Dinaric Alps"]),
        ("8", "Balkanbergen", ["Balkan"], [23.0, 42.95], regions["Balkan Mts."]),
        ("9", "Karpaterna", [], [24.5, 47.9], karpaterna),
        ("10", "Kaukasus", ["Kaukasusbergen"], [44.5, 42.5], regions["CAUCASUS MTS."]),
    ]
    items = []
    for label, name, al, pos, g in mountains:
        items.append({"id": cid(name), "label": label, "name": name, "aliases": al,
                      "group": "kedjor", "type": "range", "pos": pos, "shape": geo(g, 0.05)})
    items.append({"id": "mont-blanc", "label": "11", "name": "Mont Blanc", "aliases": [],
                  "group": "toppar", "type": "peak", "pos": [6.865, 45.833],
                  "hint": "Bergstopp – Europas högsta berg i Alperna"})
    items.append({"id": "elbrus", "label": "12", "name": "Elbrus", "aliases": [],
                  "group": "toppar", "type": "peak", "pos": [42.439, 43.355],
                  "hint": "Bergstopp – Europas högsta berg, i Kaukasus"})
    write("europa-berg", {
        "id": "europa-berg",
        "title": "Berg i Europa",
        "subject": "Geografi",
        "section": "Europa",
        "style": "physical",
        "view": EUROPE_VIEW,
        "groups": [
            {"id": "kedjor", "title": "Bergskedjor (1–10)"},
            {"id": "toppar", "title": "Bergstoppar (11–12)"},
        ],
        "items": items,
    })

    # ---------------- Hav, sjoar och floder ----------------
    W = box(-12, 35, 62, 60)
    seas = [
        ("a", "Norra ishavet", ["Ishavet", "Arktiska oceanen", "Barents hav"], [30.0, 73.5],
         sea("Barents Sea", "White Sea", "Kara Sea", "Greenland Sea", "Arctic Ocean")),
        ("b", "Atlanten", ["Atlantiska oceanen", "Atlantiska havet"], [-19.0, 48.0],
         sea("North Atlantic Ocean", "Norwegian Sea", "Bay of Biscay")),
        ("c", "Nordsjön", [], [3.0, 56.0], sea("North Sea")),
        ("d", "Östersjön", [], [18.5, 55.6],
         sea("Baltic Sea", "Gulf of Bothnia", "Gulf of Finland", "Gulf of Riga")),
        ("e", "Medelhavet", [], [5.5, 38.8],
         sea("Mediterranean Sea", "Tyrrhenian Sea", "Adriatic Sea", "Ionian Sea", "Aegean Sea",
             "Balearic Sea", "Ligurian Sea", "Alboran Sea", "Sea of Crete", "Golfe du Lion",
             "Gulf of Sidra", "Gulf of Gabès")),
        ("f", "Svarta havet", [], [34.0, 43.3], sea("Black Sea", "Sea of Azov")),
        ("g", "Kaspiska havet", ["Kaspiska"], [50.6, 42.2], sea("Caspian Sea")),
    ]
    items = []
    for label, name, al, pos, g in seas:
        items.append({"id": cid(name), "label": label, "name": name, "aliases": al,
                      "group": "hav", "type": "sea", "pos": pos, "shape": geo(g, 0.05, 2)})
    items.append({"id": "ladoga", "label": "h", "name": "Ladoga", "aliases": ["Ladogasjön"],
                  "group": "sjoar", "type": "lake", "pos": [31.6, 60.85],
                  "shape": geo(lakes["Lake Ladoga"], 0.02)})
    rv = [
        ("i", "Tejo", ["Tajo", "Tagus"], ("Tejo", "Tajo"), [-6.5, 39.75]),
        ("j", "Ebro", [], ("Ebro",), [-0.9, 41.65]),
        ("k", "Garonne", [], ("Garonne",), [0.6, 44.2]),
        ("l", "Loire", [], ("Loire",), [0.7, 47.4]),
        ("m", "Rhône", ["Rhone"], ("Rhône", "Rhne"), [4.8, 44.6]),
        ("n", "Po", [], ("Po",), [10.6, 45.05]),
        ("o", "Themsen", ["Thames"], ("Thames",), [-1.0, 51.55]),
        ("p", "Rhen", ["Rhein", "Rhenfloden"], ("Rhein", "Rhine", "Rhin"), [7.6, 50.3]),
        ("q", "Elbe", [], ("Elbe",), [11.7, 52.95]),
        ("r", "Oder", ["Odra"], ("Oder",), [14.6, 52.4]),
        ("s", "Wisła", ["Wisla", "Weichsel", "Vistula"], ("Vistula",), [19.6, 52.6]),
        ("t", "Donau", ["Danube", "Dunaj"], ("Danube", "Donau"), [24.0, 43.7]),
        ("u", "Dnepr", ["Dnipro", "Dnjepr", "Dnipr"], ("Dnipro",), [33.0, 49.3]),
        ("v", "Don", [], ("Don",), [40.3, 49.9]),
        ("w", "Volga", ["Wolga"], ("Volga",), [48.6, 55.6]),
        ("x", "Ural", ["Uralfloden"], ("Ural",), [51.5, 50.5]),
    ]
    for label, name, al, src_names, approx in rv:
        g = river(*src_names, within=W)
        items.append({"id": cid(name).replace("ł", "l"), "label": label, "name": name,
                      "aliases": al, "group": "floder", "type": "river",
                      "pos": snap(g, *approx), "shape": geo(g, 0.01)})
    write("europa-vatten", {
        "id": "europa-vatten",
        "title": "Hav, sjöar och floder i Europa",
        "subject": "Geografi",
        "section": "Europa",
        "style": "physical",
        "view": EUROPE_VIEW,
        "groups": [
            {"id": "hav", "title": "Hav (a–g)"},
            {"id": "sjoar", "title": "Sjöar (h)"},
            {"id": "floder", "title": "Floder (i–x)"},
        ],
        "items": items,
    })


def write(name, data):
    path = os.path.join(OUTDIR, name + ".json")
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print("Skrev", path, os.path.getsize(path) // 1024, "kB")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[2] != "--force":
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
