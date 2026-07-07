from __future__ import annotations

import math
import random
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from config.settings import AreaConfig
from services.ais_provider import AISDataStore, AISProvider, AISRecord


@dataclass
class FleetVessel:
    mmsi: str
    ship_name: str
    latitude: float
    longitude: float
    speed: float
    course: float
    status: str
    destination: str
    eta: str
    country: str
    vessel_type: str


class DummyAISProvider(AISProvider):
    def __init__(self, store: AISDataStore, area: AreaConfig, update_interval: int = 10) -> None:
        super().__init__(store=store, source_name="DUMMY")
        self.area = area
        self.update_interval = max(5, min(update_interval, 30))
        self._rng = random.Random(area.key)
        self._fleet: List[FleetVessel] = self._build_initial_fleet()

    def _sea_anchors(self) -> List[Tuple[float, float]]:
        anchors = {
            "TOKYO_BAY": [
                (35.18, 139.80),
                (35.08, 139.95),
                (35.02, 139.72),
                (35.25, 139.98),
                (35.12, 140.05),
            ],
            "OSAKA_BAY": [
                (34.42, 135.08),
                (34.35, 135.26),
                (34.28, 135.00),
                (34.48, 135.18),
                (34.22, 134.98),
            ],
            "ISE_BAY": [
                (34.65, 136.92),
                (34.72, 136.72),
                (34.85, 136.85),
                (34.58, 136.98),
                (34.78, 137.05),
            ],
            "SETOUCHI": [
                (34.30, 133.10),
                (34.10, 133.45),
                (34.25, 134.00),
                (34.55, 134.45),
                (34.05, 134.80),
            ],
            "NORTH_KYUSHU": [
                (33.85, 130.40),
                (33.72, 130.10),
                (33.55, 130.55),
                (33.95, 130.75),
                (33.48, 130.85),
            ],
        }
        return anchors.get(self.area.key, [(self.area.center_lat, self.area.center_lon)])

    def _jitter_around(self, lat: float, lon: float, meters: float) -> Tuple[float, float]:
        # Small random offset that stays near the sea anchor.
        meters_per_deg_lat = 111_320
        meters_per_deg_lon = 111_320 * math.cos(math.radians(lat))
        angle = self._rng.uniform(0, math.tau)
        radius = self._rng.uniform(0, meters)
        return (
            lat + math.cos(angle) * radius / meters_per_deg_lat,
            lon + math.sin(angle) * radius / max(meters_per_deg_lon, 1.0),
        )

    def _build_initial_fleet(self) -> List[FleetVessel]:
        anchors = self._sea_anchors()
        ships = [
            "Aqua Star",
            "Blue Harbor",
            "Pacific Wind",
            "Morning Tide",
            "Sea Falcon",
            "Harbor Light",
            "Ocean Crown",
            "East Horizon",
            "North Compass",
            "Wave Runner",
            "Silver Pearl",
            "Sunrise Maru",
            "Kaze Maru",
            "Shoreline",
            "Meridian",
        ]
        countries = ["JP", "JP", "KR", "CN", "JP", "SG"]
        vessel_types = ["Cargo", "Tanker", "Passenger", "Container", "Ro-Ro", "Ferry"]
        fleet: List[FleetVessel] = []
        for index in range(18):
            anchor_lat, anchor_lon = anchors[index % len(anchors)]
            lat, lon = self._jitter_around(anchor_lat, anchor_lon, meters=2500)
            speed = round(self._rng.uniform(0, 18), 1)
            course = round(self._rng.uniform(0, 359), 1)
            ship_name = f"{ships[index % len(ships)]} {index + 1}"
            status = "At Anchor" if speed < 1 else "Under Way"
            destination = self._rng.choice(["Tokyo", "Osaka", "Nagoya", "Kobe", "Busan", "Shanghai", "Yokohama"])
            eta = f"{self._rng.randint(1, 5)}h"
            fleet.append(
                FleetVessel(
                    mmsi=f"431{self._rng.randint(1000000, 9999999)}",
                    ship_name=ship_name,
                    latitude=lat,
                    longitude=lon,
                    speed=speed,
                    course=course,
                    status=status,
                    destination=destination,
                    eta=eta,
                    country=self._rng.choice(countries),
                    vessel_type=self._rng.choice(vessel_types),
                )
            )
        return fleet

    def _move_vessel(self, vessel: FleetVessel) -> FleetVessel:
        anchors = self._sea_anchors()
        speed = max(0.0, min(22.0, vessel.speed + self._rng.uniform(-1.2, 1.4)))
        if self._rng.random() < 0.1:
            speed = 0.0 if speed > 0.8 else self._rng.uniform(1.0, 9.5)
        course = (vessel.course + self._rng.uniform(-18, 18)) % 360
        status = "At Anchor" if speed < 1 else "Under Way"

        meters_per_deg_lat = 111_320
        meters_per_deg_lon = 111_320 * math.cos(math.radians(vessel.latitude))
        meters = speed * 1852 / 3600 * self.update_interval
        delta_north = math.cos(math.radians(course)) * meters / meters_per_deg_lat
        delta_east = math.sin(math.radians(course)) * meters / max(meters_per_deg_lon, 1.0)

        latitude = vessel.latitude + delta_north
        longitude = vessel.longitude + delta_east

        anchor_lat, anchor_lon = min(
            anchors,
            key=lambda anchor: (anchor[0] - latitude) ** 2 + (anchor[1] - longitude) ** 2,
        )
        max_radius_m = 4500
        dist_lat_m = (latitude - anchor_lat) * 111_320
        dist_lon_m = (longitude - anchor_lon) * max(111_320 * math.cos(math.radians(anchor_lat)), 1.0)
        distance = math.hypot(dist_lat_m, dist_lon_m)
        if distance > max_radius_m:
            latitude, longitude = self._jitter_around(anchor_lat, anchor_lon, meters=max_radius_m * 0.7)
            course = (course + 180) % 360
        else:
            latitude = latitude
            longitude = longitude

        destinations = ["Tokyo", "Osaka", "Nagoya", "Kobe", "Busan", "Shanghai", "Yokohama", "Moji"]
        if self._rng.random() < 0.05:
            vessel = FleetVessel(
                mmsi=vessel.mmsi,
                ship_name=vessel.ship_name,
                latitude=latitude,
                longitude=longitude,
                speed=speed,
                course=course,
                status=status,
                destination=self._rng.choice(destinations),
                eta=f"{self._rng.randint(1, 8)}h",
                country=vessel.country,
                vessel_type=vessel.vessel_type,
            )
        else:
            vessel.latitude = latitude
            vessel.longitude = longitude
            vessel.speed = round(speed, 1)
            vessel.course = round(course, 1)
            vessel.status = status
        return vessel

    def _emit_snapshot(self) -> None:
        now = datetime.now(timezone.utc)
        for index, vessel in enumerate(self._fleet):
            self._fleet[index] = self._move_vessel(vessel)
            payload = self._fleet[index]
            record = AISRecord(
                timestamp=now,
                ship_name=payload.ship_name,
                mmsi=payload.mmsi,
                latitude=payload.latitude,
                longitude=payload.longitude,
                speed=payload.speed,
                course=payload.course,
                status=payload.status,
                destination=payload.destination,
                eta=payload.eta,
                country=payload.country,
                vessel_type=payload.vessel_type,
                source=self.source_name,
                raw={},
            )
            self.store.upsert(record)
        self._set_state(
            status="connected",
            message=f"Dummy feed active for {self.area.label}",
        )

    def _run(self) -> None:
        self._set_state(status="connected", message=f"Dummy feed active for {self.area.label}")
        while not self._stop_event.is_set():
            self._emit_snapshot()
            self._stop_event.wait(self.update_interval)

    def start(self) -> None:
        if self.is_running:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="DummyAISProvider", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
