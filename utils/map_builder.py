from __future__ import annotations

from typing import Iterable

import folium
from folium.plugins import MarkerCluster

from config.settings import AreaConfig
from services.ais_provider import AISRecord
from utils.geo_utils import speed_color


def build_popup_html(record: AISRecord) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">{record.ship_name}</div>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td><b>MMSI</b></td><td>{record.mmsi}</td></tr>
        <tr><td><b>Latitude</b></td><td>{record.latitude:.5f}</td></tr>
        <tr><td><b>Longitude</b></td><td>{record.longitude:.5f}</td></tr>
        <tr><td><b>Speed</b></td><td>{record.speed:.1f} kt</td></tr>
        <tr><td><b>Course</b></td><td>{record.course:.1f} deg</td></tr>
        <tr><td><b>Status</b></td><td>{record.status}</td></tr>
        <tr><td><b>Destination</b></td><td>{record.destination}</td></tr>
        <tr><td><b>ETA</b></td><td>{record.eta}</td></tr>
      </table>
    </div>
    """


def build_map(area: AreaConfig, records: Iterable[AISRecord]) -> folium.Map:
    fmap = folium.Map(location=[area.center_lat, area.center_lon], zoom_start=area.zoom, control_scale=True)
    cluster = MarkerCluster(name="Vessels").add_to(fmap)

    for record in records:
        color = speed_color(record.speed)
        folium.CircleMarker(
            location=[record.latitude, record.longitude],
            radius=6 if record.speed <= 1 else 7,
            color=color,
            weight=2,
            fill=True,
            fill_color=color,
            fill_opacity=0.85,
            tooltip=f"{record.ship_name} | {record.speed:.1f} kt",
            popup=folium.Popup(build_popup_html(record), max_width=320),
        ).add_to(cluster)

    bounds = [[area.bounds[0][0], area.bounds[0][1]], [area.bounds[1][0], area.bounds[1][1]]]
    folium.Rectangle(
        bounds=bounds,
        color="#94a3b8",
        weight=1,
        fill=False,
        opacity=0.6,
    ).add_to(fmap)

    legend_html = """
    <div style="
        position: fixed;
        bottom: 28px;
        left: 28px;
        z-index: 9999;
        background: rgba(255,255,255,0.95);
        padding: 10px 12px;
        border: 1px solid #d9e2ec;
        border-radius: 8px;
        box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
        font-size: 12px;
        color: #0f172a;
    ">
      <div style="font-weight: 700; margin-bottom: 6px;">Speed Legend</div>
      <div><span style="display:inline-block;width:10px;height:10px;background:#d73027;border-radius:999px;margin-right:6px;"></span>0-1 kt</div>
      <div><span style="display:inline-block;width:10px;height:10px;background:#fdae61;border-radius:999px;margin-right:6px;"></span>1-10 kt</div>
      <div><span style="display:inline-block;width:10px;height:10px;background:#1a9850;border-radius:999px;margin-right:6px;"></span>10 kt+</div>
    </div>
    """
    fmap.get_root().html.add_child(folium.Element(legend_html))
    return fmap

