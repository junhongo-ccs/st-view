from __future__ import annotations

import pandas as pd
import streamlit as st

from config.settings import AREAS, load_settings
from services.provider_manager import create_provider_manager_for_area
from utils.geo_utils import apply_filters, count_by_status, format_timestamp
from utils.map_builder import build_map

try:
    from streamlit_autorefresh import st_autorefresh
except Exception:  # pragma: no cover
    st_autorefresh = None

try:
    from streamlit_folium import st_folium
except Exception:  # pragma: no cover
    st_folium = None


st.set_page_config(
    page_title="Vessel Tracking Dashboard",
    page_icon="ship",
    layout="wide",
    initial_sidebar_state="expanded",
)


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        :root {
            color-scheme: light;
        }
        .stApp {
            background: #e2e8f0;
            color: #0f172a;
        }
        .stApp * {
            -webkit-font-smoothing: antialiased;
        }
        [data-testid="stSidebar"] {
            background: #ffffff !important;
            border-right: 1px solid #e2e8f0;
            color: #0f172a !important;
            color-scheme: light;
        }
        [data-testid="stSidebar"] *,
        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] span,
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] h1,
        [data-testid="stSidebar"] h2,
        [data-testid="stSidebar"] h3,
        [data-testid="stSidebar"] h4,
        [data-testid="stSidebar"] h5,
        [data-testid="stSidebar"] h6 {
            color: #0f172a !important;
            background-color: transparent !important;
            text-shadow: none !important;
        }
        .block-container {
            padding-top: 1.25rem;
            padding-bottom: 1.25rem;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
            max-width: 100%;
        }
        [data-testid="stSidebar"] h1 {
            font-size: 1.25rem;
            line-height: 1.4;
            font-weight: 700;
            padding: 0.35rem 0 0.25rem 0;
            margin-bottom: 0.25rem;
        }
        [data-testid="stSidebar"] [data-testid="stCaptionContainer"] p {
            font-size: 0.82rem;
            line-height: 1.45;
            color: #475569 !important;
        }
        [data-testid="stSidebar"] [data-testid="stWidgetLabel"] {
            font-size: 0.92rem;
            font-weight: 700;
            line-height: 1.35;
            letter-spacing: 0.01em;
            margin-bottom: 0.3rem;
        }
        [data-testid="stSidebar"] [data-testid="stWidgetLabel"] p {
            margin: 0;
            color: #0f172a !important;
            font-weight: 700 !important;
        }
        [data-testid="stSidebar"] .stSelectbox label,
        [data-testid="stSidebar"] .stTextInput label {
            color: #0f172a !important;
        }
        [data-testid="stSidebar"] .stSelectbox,
        [data-testid="stSidebar"] .stTextInput,
        [data-testid="stSidebar"] [data-testid="stToggle"] {
            margin-bottom: 0.8rem;
        }
        [data-testid="stSidebar"] input,
        [data-testid="stSidebar"] [role="combobox"],
        [data-testid="stSidebar"] button[aria-label="Open"] {
            background: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
            box-shadow: none !important;
        }
        [data-testid="stSidebar"] input::placeholder {
            color: #64748b !important;
            opacity: 1;
        }
        [data-testid="stSidebar"] [data-baseweb="select"] {
            background: #ffffff !important;
            border: 1.5px solid #94a3b8 !important;
            border-radius: 10px !important;
        }
        [data-testid="stSidebar"] [data-testid="stTextInputRootElement"] {
            background: #ffffff !important;
            border: 1.5px solid #cbd5e1 !important;
            border-radius: 10px !important;
        }
        [data-testid="stSidebar"] [data-testid="stTextInputRootElement"]:focus-within,
        [data-testid="stSidebar"] [data-baseweb="select"]:focus-within,
        [data-testid="stSidebar"] [data-baseweb="select"] [role="combobox"]:focus {
            border-color: #64748b !important;
            box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.12) !important;
        }
        [data-testid="stSidebar"] [data-baseweb="select"] [role="combobox"] {
            background: #ffffff !important;
            color: #0f172a !important;
        }
        [data-testid="stSidebar"] .stButton button,
        [data-testid="stSidebar"] .stDownloadButton button {
            background: #f8fafc !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
        }
        .dashboard-hero {
            background: linear-gradient(135deg, #f1f5f9 0%, #dbe4ee 100%);
            border: 1px solid #b8c4d2;
            border-radius: 14px;
            padding: 18px 20px;
            margin-bottom: 14px;
        }
        .dashboard-muted {
            color: #64748b;
            font-size: 0.92rem;
        }
        .kpi-card {
            background: #f8fafc;
            border: 1px solid #b8c4d2;
            border-radius: 12px;
            padding: 14px 16px;
            min-height: 92px;
        }
        .kpi-label {
            color: #64748b;
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
        }
        .kpi-value {
            color: #0f172a;
            font-size: 1.8rem;
            font-weight: 700;
            line-height: 1.1;
        }
        .kpi-subtext {
            color: #475569;
            font-size: 0.82rem;
            margin-top: 4px;
        }
        .panel {
            background: #f8fafc;
            border: 1px solid #b8c4d2;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 14px;
        }
        .panel .panel-title {
            font-size: 0.95rem;
            font-weight: 700;
            line-height: 1.4;
            color: #0f172a;
            margin-bottom: 0.35rem;
        }
        .panel ul, .panel li {
            color: #0f172a;
            margin-top: 0.25rem;
        }
        div[data-testid="stDataFrame"] {
            border: 1px solid #b8c4d2;
            border-radius: 12px;
            overflow: hidden;
        }
        .stDataFrame [role="grid"] {
            color: #0f172a;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


@st.cache_resource
def load_service(area_key: str, data_mode: str, ais_provider: str, api_key: str, refresh_seconds: int, max_records: int):
    settings = load_settings()
    return create_provider_manager_for_area(settings, area_key)


def render_kpi(label: str, value: str, subtext: str = "") -> None:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">{label}</div>
            <div class="kpi-value">{value}</div>
            <div class="kpi-subtext">{subtext}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def main() -> None:
    inject_styles()
    settings = load_settings()

    st.markdown(
        """
        <div class="dashboard-hero">
            <div style="font-size: 1.6rem; font-weight: 700; margin-bottom: 4px;">Ship Tracking Dashboard</div>
            <div class="dashboard-muted">顧客向け提案デモとして、対象海域の船舶を地図と一覧で同時に可視化します。</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.sidebar.title("Control Panel")
    st.sidebar.caption("業務向けの高密度レイアウトを前提にした操作パネルです。")

    area_label_by_key = {key: config.label for key, config in AREAS.items()}
    default_area_index = list(AREAS).index(settings.default_area) if settings.default_area in AREAS else 0
    selected_area_key = st.sidebar.selectbox(
        "海域",
        options=list(AREAS.keys()),
        index=default_area_index,
        format_func=lambda key: area_label_by_key[key],
    )
    # Cache key includes live settings so changing .env creates a fresh provider.
    service = load_service(
        selected_area_key,
        settings.data_mode,
        settings.ais_provider,
        settings.aisstream_api_key,
        settings.refresh_seconds,
        settings.max_records,
    )
    area = service.area

    auto_refresh_enabled = st.sidebar.toggle("自動更新", value=True)
    refresh_options = [30, 60, 120]
    refresh_index = refresh_options.index(settings.refresh_seconds) if settings.refresh_seconds in refresh_options else 0
    refresh_seconds = st.sidebar.selectbox("更新間隔", options=refresh_options, index=refresh_index)
    if auto_refresh_enabled and st_autorefresh is not None:
        st_autorefresh(interval=refresh_seconds * 1000, key=f"dashboard_refresh_{selected_area_key}")

    mmsi_filter = st.sidebar.text_input("MMSI", placeholder="部分一致で検索")
    country_filter = st.sidebar.text_input("国籍", placeholder="JP / KR / CN など")
    ship_name_filter = st.sidebar.text_input("船名", placeholder="部分一致で検索")

    st.sidebar.markdown(
        """
        <div class="panel">
            <div class="panel-title">Future Vision</div>
            <div style="font-size: 0.88rem; color: #475569; line-height: 1.6;">
                - 衛星AIS連携<br>
                - 世界中の船舶追跡<br>
                - 入港遅延予測<br>
                - 過去航跡分析<br>
                - サプライチェーン可視化<br>
                - アラート通知
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    st.sidebar.markdown(
        f"""
        <div class="panel">
            <div class="panel-title">Connection</div>
            <div style="font-size: 0.88rem; color: #475569; line-height: 1.6;">
                Area: {area.label}<br>
                Source: {service.source_name}<br>
                State: {service.state.status}<br>
                Last update: {format_timestamp(service.state.last_updated, settings.tz) if service.state.last_updated else "-"}<br>
                Reconnects: {service.state.reconnect_attempts}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if service.fallback_reason:
        st.warning(service.fallback_reason)
    if settings.data_mode == "API" and service.source_name == "DUMMY":
        st.warning("API モードですが、AISStream に接続できずダミーデータで表示されています。")

    if service.state.last_error and service.state.status in {"reconnecting", "error"}:
        st.warning(f"AISデータへ接続できません: {service.state.last_error}")

    if not auto_refresh_enabled:
        st.info("自動更新はOFFです。必要に応じて手動で再描画してください。")

    snapshot = service.snapshot()
    frame = snapshot.to_dataframe()

    if frame.empty:
        st.info("現在表示可能な船舶データが存在しません。")
        return

    frame = frame.sort_values("Timestamp", ascending=False)
    filtered = apply_filters(frame, mmsi_filter=mmsi_filter, country_filter=country_filter, ship_name_filter=ship_name_filter)

    mmsi_values = set(filtered["MMSI"].astype(str)) if not filtered.empty else set()
    selected_records = [record for record in snapshot.records if str(record.mmsi) in mmsi_values]

    tracked = len(filtered)
    under_way = count_by_status(filtered, "Under Way")
    at_anchor = count_by_status(filtered, "At Anchor")
    eta_today = int((filtered["ETA"].astype(str) != "").sum()) if "ETA" in filtered else 0

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        render_kpi("Tracked Vessels", str(tracked), f"Latest {snapshot.history_count} events")
    with col2:
        render_kpi("Under Way", str(under_way), "航行中")
    with col3:
        render_kpi("At Anchor", str(at_anchor), "停泊中")
    with col4:
        render_kpi("ETA Today", str(eta_today), "ETA取得件数")

    map_col, table_col = st.columns([1.1, 0.9], gap="large")
    with map_col:
        st.markdown("### Map")
        fmap = build_map(area, selected_records)
        if st_folium is not None:
            st_folium(fmap, height=640, width=None, returned_objects=[])
        else:
            st.warning("streamlit-folium が利用できないため、地図描画をスキップしました。")

    with table_col:
        st.markdown("### Vessel Table")
        display_frame = filtered.copy()
        display_frame["Timestamp"] = (
            pd.to_datetime(display_frame["Timestamp"], utc=True)
            .dt.tz_convert(settings.tz)
            .dt.strftime("%Y-%m-%d %H:%M:%S")
        )
        display_frame = display_frame[
            [
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
            ]
        ]
        st.dataframe(display_frame, use_container_width=True, height=540)
        csv_data = display_frame.to_csv(index=False).encode("utf-8-sig")
        st.download_button(
            "CSV Download",
            data=csv_data,
            file_name="vessel_tracking.csv",
            mime="text/csv",
            use_container_width=True,
        )

    st.markdown("### Operational Notes")
    st.caption("背景の淡色、薄い罫線、抑えた角丸で業務アプリらしい情報密度を維持しています。")


if __name__ == "__main__":
    main()
