from __future__ import annotations

import asyncio
import json
import random
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

import websockets

from config.settings import AreaConfig
from services.ais_provider import AISDataStore, AISProvider, parse_ais_message


class AISStreamProvider(AISProvider):
    def __init__(
        self,
        store: AISDataStore,
        api_key: str,
        area: AreaConfig,
        message_types: Iterable[str] | None = None,
    ) -> None:
        super().__init__(store=store, source_name="AISSTREAM")
        self.api_key = api_key
        self.area = area
        self.message_types = list(
            message_types
            or ["PositionReport", "ShipStaticData", "StaticDataReport", "ExtendedClassBPositionReport", "StandardClassBPositionReport"]
        )
        self._base_url = "wss://stream.aisstream.io/v0/stream"

    def _subscription_message(self) -> Dict[str, Any]:
        return {
            "APIKey": self.api_key,
            "BoundingBoxes": self.area.bounding_box,
            "FilterMessageTypes": self.message_types,
        }

    async def _consume(self) -> None:
        backoff = 1
        reconnect_attempts = 0
        while not self._stop_event.is_set():
            try:
                self._set_state(
                    status="connecting" if reconnect_attempts == 0 else "reconnecting",
                    message=f"Connecting to AISStream for {self.area.label}",
                    reconnect_attempts=reconnect_attempts,
                )
                async with websockets.connect(
                    self._base_url,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=10,
                    max_queue=256,
                ) as socket:
                    await socket.send(json.dumps(self._subscription_message()))
                    self._set_state(
                        status="connected",
                        message=f"AISStream live for {self.area.label}",
                        reconnect_attempts=reconnect_attempts,
                    )
                    async for message_json in socket:
                        if self._stop_event.is_set():
                            break
                        try:
                            message = json.loads(message_json)
                        except json.JSONDecodeError:
                            continue
                        record = parse_ais_message(message, source_name=self.source_name)
                        if record is not None:
                            self.store.upsert(record)
                            self._set_state(
                                status="connected",
                                message=f"Receiving AISStream updates for {self.area.label}",
                                reconnect_attempts=reconnect_attempts,
                            )
                    reconnect_attempts = 0
                    backoff = 1
            except asyncio.CancelledError:
                break
            except Exception as exc:
                reconnect_attempts += 1
                self._set_state(
                    status="reconnecting",
                    message=f"AISStream reconnecting for {self.area.label}",
                    last_error=str(exc),
                    reconnect_attempts=reconnect_attempts,
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)
        self._set_state(status="stopped", message="AISStream listener stopped")

    def _run(self) -> None:
        try:
            asyncio.run(self._consume())
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._consume())
            loop.close()

    def start(self) -> None:
        if self.is_running:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name="AISStreamProvider", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

