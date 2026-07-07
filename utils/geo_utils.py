from __future__ import annotations

from datetime import datetime
from typing import Iterable, List
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import pandas as pd

try:
    import geopandas as gpd
    from shapely.geometry import Point
except Exception:  # pragma: no cover
    gpd = None
    Point = None

from services.ais_provider import AISRecord


def speed_color(speed: float) -> str:
    if speed <= 1:
        return "#d73027"
    if speed <= 10:
        return "#fdae61"
    return "#1a9850"


def status_category(status: str) -> str:
    text = str(status).lower()
    if "anchor" in text or "停泊" in text:
        return "At Anchor"
    return "Under Way"


def format_timestamp(value: datetime, tz_name: str = "Asia/Tokyo") -> str:
    if isinstance(value, datetime):
        try:
            timezone = ZoneInfo(tz_name)
        except ZoneInfoNotFoundError:
            timezone = ZoneInfo("Asia/Tokyo")
        return value.astimezone(timezone).strftime("%Y-%m-%d %H:%M:%S")
    return str(value)


def records_to_dataframe(records: Iterable[AISRecord]) -> pd.DataFrame:
    rows = []
    for record in records:
        rows.append(
            {
                "Timestamp": record.timestamp,
                "Ship Name": record.ship_name,
                "MMSI": record.mmsi,
                "Latitude": record.latitude,
                "Longitude": record.longitude,
                "Speed": record.speed,
                "Course": record.course,
                "Status": record.status,
                "Destination": record.destination,
                "ETA": record.eta,
                "Country": record.country,
                "Vessel Type": record.vessel_type,
                "Source": record.source,
            }
        )
    return pd.DataFrame(rows)


def records_to_geodataframe(records: Iterable[AISRecord]):
    frame = records_to_dataframe(records)
    if frame.empty:
        if gpd is None:
            return frame
        return gpd.GeoDataFrame(frame.copy(), geometry=gpd.GeoSeries([], crs="EPSG:4326"))
    if gpd is None or Point is None:
        frame["geometry"] = None
        return frame
    geometry = [Point(lon, lat) for lat, lon in zip(frame["Latitude"], frame["Longitude"])]
    return gpd.GeoDataFrame(frame, geometry=geometry, crs="EPSG:4326")


def apply_filters(
    frame: pd.DataFrame,
    mmsi_filter: str = "",
    country_filter: str = "",
    ship_name_filter: str = "",
) -> pd.DataFrame:
    filtered = frame.copy()
    if filtered.empty:
        return filtered
    if mmsi_filter.strip():
        filtered = filtered[filtered["MMSI"].astype(str).str.contains(mmsi_filter.strip(), case=False, na=False)]
    if country_filter.strip():
        filtered = filtered[filtered["Country"].astype(str).str.contains(country_filter.strip(), case=False, na=False)]
    if ship_name_filter.strip():
        filtered = filtered[filtered["Ship Name"].astype(str).str.contains(ship_name_filter.strip(), case=False, na=False)]
    return filtered


def count_by_status(frame: pd.DataFrame, expected: str) -> int:
    if frame.empty or "Status" not in frame:
        return 0
    return int(frame["Status"].astype(str).apply(status_category).eq(expected).sum())
