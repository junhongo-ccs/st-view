from __future__ import annotations

from dataclasses import dataclass, replace

from config.settings import AppSettings, AREAS, AreaConfig
from services.ais_provider import AISDataStore, AISProvider, ProviderSnapshot
from services.aisstream_provider import AISStreamProvider
from services.dummy_provider import DummyAISProvider


@dataclass
class ProviderManager:
    settings: AppSettings
    area: AreaConfig
    provider: AISProvider
    fallback_reason: str = ""

    def snapshot(self) -> ProviderSnapshot:
        return self.provider.snapshot()

    @property
    def source_name(self) -> str:
        return self.provider.source_name

    @property
    def state(self):
        return self.provider.state


class UnavailableAISProvider(AISProvider):
    def __init__(self, store: AISDataStore, source_name: str, message: str) -> None:
        super().__init__(store=store, source_name=source_name)
        self.message = message

    def start(self) -> None:
        self._set_state(status="error", message=self.message, last_error=self.message)

    def stop(self) -> None:
        self._set_state(status="stopped", message="Provider stopped")


def create_provider_manager(settings: AppSettings) -> ProviderManager:
    area = AREAS.get(settings.default_area, AREAS["TOKYO_BAY"])
    store = AISDataStore(max_records=settings.max_records)

    if settings.data_mode == "DUMMY":
        provider = DummyAISProvider(store=store, area=area, update_interval=settings.refresh_seconds)
        provider.start()
        return ProviderManager(settings=settings, area=area, provider=provider)

    if settings.data_mode != "API":
        message = f"DATA_MODE={settings.data_mode} は未対応です。DUMMY または API を指定してください。"
        provider = UnavailableAISProvider(store=store, source_name=settings.ais_provider, message=message)
        provider.start()
        return ProviderManager(settings=settings, area=area, provider=provider, fallback_reason=message)

    if settings.ais_provider != "AISSTREAM":
        message = f"AIS_PROVIDER={settings.ais_provider} は未対応です。このPoCは AISSTREAM のみ対応しています。"
        provider = UnavailableAISProvider(store=store, source_name=settings.ais_provider, message=message)
        provider.start()
        return ProviderManager(settings=settings, area=area, provider=provider, fallback_reason=message)

    if is_configured_api_key(settings.aisstream_api_key):
        provider = AISStreamProvider(store=store, api_key=settings.aisstream_api_key, area=area)
        provider.start()
        return ProviderManager(settings=settings, area=area, provider=provider)

    message = "AISSTREAM_API_KEY が未設定のため、AISStreamへ接続していません。"
    provider = UnavailableAISProvider(store=store, source_name="AISSTREAM", message=message)
    provider.start()
    return ProviderManager(settings=settings, area=area, provider=provider, fallback_reason=message)


def create_provider_manager_for_area(settings: AppSettings, area_key: str) -> ProviderManager:
    return create_provider_manager(replace(settings, default_area=area_key))


def is_configured_api_key(value: str) -> bool:
    normalized = value.strip()
    return bool(normalized and normalized != "YOUR_AISSTREAM_API_KEY")
