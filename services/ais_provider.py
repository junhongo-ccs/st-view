from __future__ import annotations

from abc import ABC, abstractmethod
from collections import OrderedDict, deque
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import threading
from typing import Any, Deque, Dict, Iterable, List, Optional

import pandas as pd

try:
    import geopandas as gpd
    from shapely.geometry import Point
except Exception:  # pragma: no cover - geopandas is optional at runtime
    gpd = None
    Point = None


@dataclass
class AISRecord:
    timestamp: datetime
    ship_name: str
    mmsi: str
    latitude: float
    longitude: float
    speed: float
    course: float
    status: str
    destination: str
    eta: str
    country: str = ""
    vessel_type: str = ""
    source: str = "UNKNOWN"
    raw: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["timestamp"] = self.timestamp.isoformat()
        return payload

    @property
    def speed_bucket(self) -> str:
        if self.speed <= 1:
            return "slow"
        if self.speed <= 10:
            return "medium"
        return "fast"


@dataclass
class ProviderState:
    status: str = "stopped"
    message: str = ""
    last_error: str = ""
    last_updated: Optional[datetime] = None
    reconnect_attempts: int = 0


@dataclass
class ProviderSnapshot:
    records: List[AISRecord]
    state: ProviderState
    source: str
    history_count: int

    def to_dataframe(self) -> pd.DataFrame:
        if not self.records:
            return pd.DataFrame(
                columns=[
                    "Timestamp",
                    "Ship Name",
                    "MMSI",
                    "Latitude",
                    "Longitude",
                    "Speed",
                    "Course",
                    "Status",
                    "Destination",
                    "ETA",
                    "Country",
                    "Vessel Type",
                    "Source",
                ]
            )
        rows = []
        for record in self.records:
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


class AISDataStore:
    def __init__(self, max_records: int = 500) -> None:
        self.max_records = max_records
        self._lock = threading.Lock()
        self._latest_by_mmsi: "OrderedDict[str, AISRecord]" = OrderedDict()
        self._history: Deque[AISRecord] = deque(maxlen=max_records)
        self._fingerprints: Dict[str, str] = {}

    def _fingerprint(self, record: AISRecord) -> str:
        return "|".join(
            [
                record.mmsi,
                f"{record.latitude:.4f}",
                f"{record.longitude:.4f}",
                f"{record.speed:.1f}",
                f"{record.course:.1f}",
                record.status,
                record.destination,
                record.eta,
            ]
        )

    def upsert(self, record: AISRecord) -> bool:
        with self._lock:
            fingerprint = self._fingerprint(record)
            if self._fingerprints.get(record.mmsi) == fingerprint:
                return False
            self._fingerprints[record.mmsi] = fingerprint
            self._latest_by_mmsi[record.mmsi] = record
            self._latest_by_mmsi.move_to_end(record.mmsi)
            while len(self._latest_by_mmsi) > self.max_records:
                old_mmsi, _ = self._latest_by_mmsi.popitem(last=False)
                self._fingerprints.pop(old_mmsi, None)
            self._history.append(record)
            return True

    def latest_records(self) -> List[AISRecord]:
        with self._lock:
            records = list(self._latest_by_mmsi.values())
        return sorted(records, key=lambda item: item.timestamp, reverse=True)

    def history_records(self) -> List[AISRecord]:
        with self._lock:
            return list(self._history)

    def history_count(self) -> int:
        with self._lock:
            return len(self._history)


class AISProvider(ABC):
    def __init__(self, store: AISDataStore, source_name: str) -> None:
        self.store = store
        self.source_name = source_name
        self.state = ProviderState()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    @abstractmethod
    def start(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def stop(self) -> None:
        raise NotImplementedError

    def snapshot(self) -> ProviderSnapshot:
        return ProviderSnapshot(
            records=self.store.latest_records(),
            state=self.state,
            source=self.source_name,
            history_count=self.store.history_count(),
        )

    @property
    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def _set_state(
        self,
        status: str,
        message: str = "",
        last_error: str = "",
        reconnect_attempts: Optional[int] = None,
    ) -> None:
        self.state.status = status
        self.state.message = message
        self.state.last_error = last_error
        self.state.last_updated = datetime.now(timezone.utc)
        if reconnect_attempts is not None:
            self.state.reconnect_attempts = reconnect_attempts


def parse_eta(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        date_fields = ["date", "Date", "datetime", "DateTime", "time", "Time"]
        collected = []
        for key in date_fields:
            if key in value and value[key]:
                collected.append(str(value[key]))
        if collected:
            return " ".join(collected)
    return str(value)


def normalize_ship_name(name: Any, fallback: str = "") -> str:
    if isinstance(name, str) and name.strip():
        return name.strip()
    return fallback


def extract_any(source: Dict[str, Any], *candidates: str, default: Any = None) -> Any:
    for candidate in candidates:
        if candidate in source and source[candidate] not in (None, ""):
            return source[candidate]
    lowered = {key.lower(): key for key in source}
    for candidate in candidates:
        key = lowered.get(candidate.lower())
        if key and source[key] not in (None, ""):
            return source[key]
    return default


def parse_ais_message(message: Dict[str, Any], source_name: str = "AISSTREAM") -> Optional[AISRecord]:
    message_type = str(message.get("MessageType", "")).strip()
    metadata = message.get("Metadata") or message.get("MetaData") or {}
    inner = message.get("Message") or {}
    payload: Dict[str, Any] = {}
    if isinstance(inner, dict) and message_type in inner and isinstance(inner[message_type], dict):
        payload = inner[message_type]
    elif isinstance(inner, dict):
        payload = inner

    combined = {**payload, **metadata}

    mmsi = extract_any(
        combined,
        "MMSI",
        "UserID",
        "ShipMMSI",
        "mmsi",
        default="",
    )
    latitude = extract_any(combined, "Latitude", "latitude", default=None)
    longitude = extract_any(combined, "Longitude", "longitude", default=None)
    if latitude is None or longitude is None:
        return None

    ship_name = normalize_ship_name(
        extract_any(
            combined,
            "ShipName",
            "Name",
            "VesselName",
            "ship_name",
            default="",
        ),
        fallback=f"Vessel {mmsi}",
    )
    speed = float(
        extract_any(
            combined,
            "SOG",
            "SpeedOverGround",
            "Speed",
            "speed",
            default=0.0,
        )
        or 0.0
    )
    course = float(
        extract_any(
            combined,
            "COG",
            "CourseOverGround",
            "Course",
            "course",
            default=0.0,
        )
        or 0.0
    )
    status = str(
        extract_any(
            combined,
            "NavigationalStatus",
            "Status",
            "navigation_status",
            default="Under Way",
        )
        or "Under Way"
    )
    destination = str(
        extract_any(combined, "Destination", "destination", default="") or ""
    )
    eta = parse_eta(extract_any(combined, "ETA", "Eta", "EstimatedTimeOfArrival", default=""))
    country = str(extract_any(combined, "Country", "country", default="") or "")
    vessel_type = str(extract_any(combined, "ShipType", "VesselType", "type", default="") or "")

    return AISRecord(
        timestamp=datetime.now(timezone.utc),
        ship_name=ship_name,
        mmsi=str(mmsi),
        latitude=float(latitude),
        longitude=float(longitude),
        speed=speed,
        course=course,
        status=status,
        destination=destination,
        eta=eta,
        country=country,
        vessel_type=vessel_type,
        source=source_name,
        raw=message,
    )
