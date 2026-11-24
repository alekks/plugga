#!/usr/bin/env python3
"""
Bygger grundkartan data/base/world.json fran Natural Earth (public domain).

Behovs bara om du vill bygga om grundkartan. Kraver: pip install shapely
Kor:  python3 tools/build_base.py <mapp-med-natural-earth-geojson>

Filer som behovs i mappen (hamtas fran
https://github.com/nvkelso/natural-earth-vector/tree/master/geojson):
  ne_50m_admin_0_countries.geojson
  ne_50m_lakes.geojson
  ne_50m_rivers_lake_centerlines.geojson
  ne_10m_geography_regions_polys.geojson
"""
import json
import os
import sys

from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
from shapely.geometry import Polygon, MultiPolygon

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "base", "world.json")


def rnd(obj, nd):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [rnd(o, nd) for o in obj]
    return obj


def d3_orient(geom):
    """d3-geo vill ha medurs ytterring (tvartemot GeoJSON RFC 7946)."""
    if isinstance(geom, Polygon):
        return orient(geom, sign=-1.0)
    if isinstance(geom, MultiPolygon):
        return MultiPolygon([orient(p, sign=-1.0) for p in geom.geoms])
    return geom


def clean(geom, tol, nd=3):
    g = geom.simplify(tol, preserve_topology=True) if tol else geom
    if g.is_empty:
        g = geom
    g = d3_orient(g)
    m = mapping(g)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"], nd)}


def load(src, name):
    with open(os.path.join(src, name)) as f:
        return json.load(f)["features"]


def main(src):
    out = {}

    countries = []
    for ft in load(src, "ne_50m_admin_0_countries.geojson"):
        p = ft["properties"]
        g = shape(ft["geometry"])
        tol = 0 if g.area < 0.05 else 0.02
        countries.append({
            "type": "Feature",
            "properties": {"n": p.get("NAME_SV") or p["NAME"], "c": p["MAPCOLOR7"]},
            "geometry": clean(g, tol),
        })
    out["countries"] = {"type": "FeatureCollection", "features": countries}

    lakes = []
    for ft in load(src, "ne_50m_lakes.geojson"):
        g = shape(ft["geometry"])
        lakes.append({"type": "Feature", "properties": {},
                      "geometry": clean(g, 0.02)})
    out["lakes"] = {"type": "FeatureCollection", "features": lakes}

    rivers = []
    for ft in load(src, "ne_50m_rivers_lake_centerlines.geojson"):
        p = ft["properties"]
        g = shape(ft["geometry"])
        rivers.append({"type": "Feature", "properties": {"r": p.get("scalerank", 5)},
                       "geometry": clean(g, 0.02)})
    out["rivers"] = {"type": "FeatureCollection", "features": rivers}

    ranges = []
    for ft in load(src, "ne_10m_geography_regions_polys.geojson"):
        p = ft["properties"]
        if p.get("FEATURECLA") != "Range/mtn":
            continue
        g = shape(ft["geometry"])
        ranges.append({"type": "Feature", "properties": {},
                       "geometry": clean(g, 0.05, 2)})
    out["ranges"] = {"type": "FeatureCollection", "features": ranges}

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print("Skrev", OUT, os.path.getsize(OUT) // 1024, "kB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
