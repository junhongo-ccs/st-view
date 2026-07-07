from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Dict, Tuple

from dotenv import load_dotenv


@dataclass(frozen=True)
class AreaConfig:
    key: str
    label: str
    center_lat: float
    center_lon: float
    zoom: int
    bounds: Tuple[Tuple[float, float], Tuple[float, float]]

    @property
    def bounding_box(self) -> list[list[list[float]]]:
        (south, west), (north, east) = self.bounds
        return [[[south, west], [north, east]]]


@dataclass(frozen=True)
class AppSettings:
    data_mode: str
    default_area: str
    refresh_seconds: int
    max_records: int
    ais_provider: str
    aisstream_api_key: str
    log_level: str
    tz: str


AREAS: Dict[str, AreaConfig] = {
    "TOKYO_BAY": AreaConfig(
        key="TOKYO_BAY",
        label="東京湾",
        center_lat=35.32,
        center_lon=139.86,
        zoom=8,
        bounds=((34.85, 139.35), (35.85, 140.45)),
    ),
    "OSAKA_BAY": AreaConfig(
        key="OSAKA_BAY",
        label="大阪湾",
        center_lat=34.55,
        center_lon=135.18,
        zoom=8,
        bounds=((33.95, 134.55), (35.05, 135.95)),
    ),
    "ISE_BAY": AreaConfig(
        key="ISE_BAY",
        label="伊勢湾",
        center_lat=34.88,
        center_lon=136.83,
        zoom=8,
        bounds=((34.1, 136.0), (35.55, 137.45)),
    ),
    "SETOUCHI": AreaConfig(
        key="SETOUCHI",
        label="瀬戸内海",
        center_lat=34.2,
        center_lon=133.7,
        zoom=7,
        bounds=((33.1, 131.8), (35.3, 135.8)),
    ),
    "NORTH_KYUSHU": AreaConfig(
        key="NORTH_KYUSHU",
        label="九州北部",
        center_lat=33.62,
        center_lon=130.4,
        zoom=8,
        bounds=((32.85, 129.5), (34.7, 131.2)),
    ),
}


def load_settings() -> AppSettings:
    load_dotenv()
    return AppSettings(
        data_mode=os.getenv("DATA_MODE", "DUMMY").strip().upper(),
        default_area=os.getenv("DEFAULT_AREA", "TOKYO_BAY").strip().upper(),
        refresh_seconds=int(os.getenv("REFRESH_SECONDS", "30")),
        max_records=int(os.getenv("MAX_RECORDS", "500")),
        ais_provider=os.getenv("AIS_PROVIDER", "AISSTREAM").strip().upper(),
        aisstream_api_key=os.getenv("AISSTREAM_API_KEY", "").strip(),
        log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
        tz=os.getenv("TZ", "Asia/Tokyo").strip(),
    )


def get_default_area(settings: AppSettings) -> AreaConfig:
    return AREAS.get(settings.default_area, AREAS["TOKYO_BAY"])

