"""
Carbon- and Latency-Aware Scheduler — Python FastAPI Sidecar

Endpoints:
  GET  /health
  POST /carbon/cloud     → EcoLogits measurement for a cloud LLM call
  POST /carbon/local     → CodeCarbon measurement for a local LLM call
  GET  /grid/intensity   → Electricity Maps live grid intensity (proxied + cached)

Carbon computation rule (PRD §5/6a, Addendum D — invariant, never change):
  Cloud: EcoLogits.impacts.gwp — used as-is. NO zone lookup. NO grid multiplication.
  Local: CodeCarbon measured energy_kwh * live_grid_intensity_kg_per_kwh.

Mode:
  SIDECAR_MODE=mock  → deterministic mock responses (default)
  SIDECAR_MODE=live  → real EcoLogits + CodeCarbon + Electricity Maps
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

try:
    from dotenv import load_dotenv
    # Load .env from root repo directory or current dir
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

SIDECAR_MODE = os.getenv("SIDECAR_MODE", "mock")
ELECTRICITY_MAPS_API_KEY = os.getenv("ELECTRICITY_MAPS_API_KEY", "")
ELECTRICITY_MAPS_BASE_URL = "https://api.electricitymap.org"
CACHE_TTL_SECONDS = 300  # 5 minutes

# ──────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ──────────────────────────────────────────────────────────────────────────────


class CloudCarbonRequest(BaseModel):
    """
    For cloud requests, EcoLogits is called with provider + model + token counts.
    The response GWP is used as-is — no zone lookup, no grid multiplication.
    """
    provider: str  # e.g. "openai", "anthropic"
    model: str     # e.g. "gpt-4o-mini"
    input_tokens: int
    output_tokens: int


class CloudCarbonResponse(BaseModel):
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    gwp_mean_kgco2eq: float       # use this for scoring and actuals
    gwp_min_kgco2eq: Optional[float] = None   # for display in Route Inspector
    gwp_max_kgco2eq: Optional[float] = None   # for display in Route Inspector
    source: str  # "ecologits" | "mock"


class LocalCarbonRequest(BaseModel):
    """
    For local requests: CodeCarbon measures energy during inference,
    then we multiply by live grid intensity from Electricity Maps.
    """
    zone: str         # e.g. "IN-KA"
    # These fields are filled AFTER the inference completes
    energy_kwh: Optional[float] = None   # from CodeCarbon
    duration_seconds: Optional[float] = None


class LocalCarbonResponse(BaseModel):
    zone: str
    energy_kwh: float
    grid_intensity_gco2_per_kwh: float
    carbon_kgco2eq: float  # = energy_kwh * (grid_intensity_gco2_per_kwh / 1000)
    grid_source: str  # "live" | "mock" | "cache"
    source: str       # "codecarbon" | "mock"


class GridIntensityResponse(BaseModel):
    zone: str
    gco2_per_kwh: float
    fetched_at: float
    source: str  # "live" | "mock" | "cache"


# ──────────────────────────────────────────────────────────────────────────────
# In-memory grid intensity cache
# ──────────────────────────────────────────────────────────────────────────────

_grid_cache: dict[str, tuple[float, float]] = {}  # zone → (gco2_per_kwh, fetched_at)


def _get_cached_intensity(zone: str) -> Optional[tuple[float, float]]:
    if zone in _grid_cache:
        gco2, fetched_at = _grid_cache[zone]
        if time.time() - fetched_at < CACHE_TTL_SECONDS:
            return gco2, fetched_at
    return None


def _set_cached_intensity(zone: str, gco2: float) -> None:
    _grid_cache[zone] = (gco2, time.time())


# ──────────────────────────────────────────────────────────────────────────────
# Mock implementations
# ──────────────────────────────────────────────────────────────────────────────

MOCK_GRID_INTENSITIES: dict[str, float] = {
    "IN-KA": 650.0,
    "US-CAL-CISO": 200.0,
    "DE": 350.0,
    "FR": 85.0,
}

# Mock EcoLogits values per model (kgCO2eq per 1k tokens) — order-of-magnitude estimates
MOCK_CLOUD_CARBON_PER_1K: dict[str, float] = {
    "gpt-4o-mini": 0.00080,
    "gpt-4o": 0.00280,
    "claude-3-haiku-20240307": 0.00060,
    "claude-3-5-sonnet-20241022": 0.00200,
    "gemini-1.5-flash": 0.00070,
    "gemini-1.5-pro": 0.00250,
}
MOCK_FALLBACK_CARBON_PER_1K = 0.00150


def _mock_cloud_carbon(req: CloudCarbonRequest) -> CloudCarbonResponse:
    total_tokens = req.input_tokens + req.output_tokens
    rate = MOCK_CLOUD_CARBON_PER_1K.get(req.model, MOCK_FALLBACK_CARBON_PER_1K)
    gwp_mean = rate * total_tokens / 1000
    return CloudCarbonResponse(
        provider=req.provider,
        model=req.model,
        input_tokens=req.input_tokens,
        output_tokens=req.output_tokens,
        gwp_mean_kgco2eq=gwp_mean,
        gwp_min_kgco2eq=gwp_mean * 0.8,
        gwp_max_kgco2eq=gwp_mean * 1.3,
        source="mock",
    )


def _mock_local_carbon(req: LocalCarbonRequest) -> LocalCarbonResponse:
    gco2 = MOCK_GRID_INTENSITIES.get(req.zone, 650.0)
    energy_kwh = req.energy_kwh if req.energy_kwh is not None else 0.0003
    carbon = energy_kwh * (gco2 / 1000.0)
    return LocalCarbonResponse(
        zone=req.zone,
        energy_kwh=energy_kwh,
        grid_intensity_gco2_per_kwh=gco2,
        carbon_kgco2eq=carbon,
        grid_source="mock",
        source="mock",
    )


# ──────────────────────────────────────────────────────────────────────────────
# Live implementations
# ──────────────────────────────────────────────────────────────────────────────


def _live_cloud_carbon(req: CloudCarbonRequest) -> CloudCarbonResponse:
    """
    Use EcoLogits to estimate cloud carbon.
    
    INVARIANT: No zone lookup. No multiplication. EcoLogits output is used as-is.
    
    EcoLogits works by patching provider SDKs. For gateway-proxied calls, we use
    the EcoLogits HTTP API directly with token counts (OQ-004 resolution).
    """
    try:
        # EcoLogits HTTP API endpoint
        import urllib.request
        import json

        payload = json.dumps({
            "provider": req.provider,
            "model": req.model,
            "input_tokens": req.input_tokens,
            "output_tokens": req.output_tokens,
        }).encode()

        request = urllib.request.Request(
            "https://api.ecologits.ai/v1beta/estimations",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        
        with urllib.request.urlopen(request, timeout=10) as resp:
            data = json.loads(resp.read())

        # Parse GWP — may be float or RangeValue (ADR-001)
        gwp = data.get("impacts", {}).get("gwp", {})
        gwp_value = gwp.get("value", {})
        
        if isinstance(gwp_value, dict):
            # RangeValue — use mean (ADR-001)
            gwp_mean = gwp_value.get("mean", gwp_value.get("min", 0))
            gwp_min = gwp_value.get("min")
            gwp_max = gwp_value.get("max")
        else:
            # Scalar float
            gwp_mean = float(gwp_value)
            gwp_min = None
            gwp_max = None

        return CloudCarbonResponse(
            provider=req.provider,
            model=req.model,
            input_tokens=req.input_tokens,
            output_tokens=req.output_tokens,
            gwp_mean_kgco2eq=gwp_mean,
            gwp_min_kgco2eq=gwp_min,
            gwp_max_kgco2eq=gwp_max,
            source="ecologits",
        )
    except Exception as e:
        # Fallback to mock with a warning — never silently hide the error
        print(f"[WARNING] EcoLogits API call failed, falling back to mock: {e}")
        result = _mock_cloud_carbon(req)
        result.source = f"mock-fallback (ecologits error: {type(e).__name__})"
        return result


def _live_local_carbon(req: LocalCarbonRequest) -> LocalCarbonResponse:
    """
    Local carbon = CodeCarbon energy * live grid intensity.
    Energy must be provided by the caller (measured during inference by CodeCarbon).
    """
    if req.energy_kwh is None:
        raise HTTPException(
            status_code=422,
            detail="energy_kwh is required for live local carbon computation"
        )

    grid = _get_grid_intensity_live(req.zone)
    carbon = req.energy_kwh * (grid.gco2_per_kwh / 1000.0)

    return LocalCarbonResponse(
        zone=req.zone,
        energy_kwh=req.energy_kwh,
        grid_intensity_gco2_per_kwh=grid.gco2_per_kwh,
        carbon_kgco2eq=carbon,
        grid_source=grid.source,
        source="codecarbon",
    )


def _get_grid_intensity_live(zone: str) -> GridIntensityResponse:
    cached = _get_cached_intensity(zone)
    if cached:
        gco2, fetched_at = cached
        return GridIntensityResponse(zone=zone, gco2_per_kwh=gco2, fetched_at=fetched_at, source="cache")

    if not ELECTRICITY_MAPS_API_KEY:
        gco2 = MOCK_GRID_INTENSITIES.get(zone, 650.0)
        _set_cached_intensity(zone, gco2)
        return GridIntensityResponse(zone=zone, gco2_per_kwh=gco2, fetched_at=time.time(), source="mock")

    import urllib.request
    import json as _json

    url = f"{ELECTRICITY_MAPS_BASE_URL}/v3/carbon-intensity/latest?zone={zone}"
    request = urllib.request.Request(url, headers={"auth-token": ELECTRICITY_MAPS_API_KEY})
    
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            data = _json.loads(resp.read())
        gco2 = float(data["carbonIntensity"])
        _set_cached_intensity(zone, gco2)
        return GridIntensityResponse(zone=zone, gco2_per_kwh=gco2, fetched_at=time.time(), source="live")
    except Exception as e:
        print(f"[WARNING] Electricity Maps API failed for {zone}: {e}. Using mock value.")
        gco2 = MOCK_GRID_INTENSITIES.get(zone, 650.0)
        return GridIntensityResponse(zone=zone, gco2_per_kwh=gco2, fetched_at=time.time(), source="mock-fallback")


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[Sidecar] Starting in mode: {SIDECAR_MODE}")
    yield
    print("[Sidecar] Shutting down.")


app = FastAPI(
    title="Carbon Scheduler Sidecar",
    description="EcoLogits (cloud) + CodeCarbon (local) + Electricity Maps proxy",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hackathon scope: no auth
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": SIDECAR_MODE}


@app.post("/carbon/cloud", response_model=CloudCarbonResponse)
def cloud_carbon(req: CloudCarbonRequest) -> CloudCarbonResponse:
    """
    Estimate carbon for a cloud LLM call using EcoLogits.
    INVARIANT: No zone lookup. No multiplication. EcoLogits output as-is.
    """
    if SIDECAR_MODE == "live":
        return _live_cloud_carbon(req)
    return _mock_cloud_carbon(req)


@app.post("/carbon/local", response_model=LocalCarbonResponse)
def local_carbon(req: LocalCarbonRequest) -> LocalCarbonResponse:
    """
    Compute carbon for a local LLM call: CodeCarbon energy * live grid intensity.
    energy_kwh must be provided (measured by CodeCarbon during inference).
    """
    if SIDECAR_MODE == "live":
        return _live_local_carbon(req)
    return _mock_local_carbon(req)


@app.get("/grid/intensity", response_model=GridIntensityResponse)
def grid_intensity(zone: str = "IN-KA") -> GridIntensityResponse:
    """
    Get live grid intensity for a zone. Cached for 5 minutes.
    Used by local carbon computation only — never for cloud candidates.
    """
    if SIDECAR_MODE == "live":
        return _get_grid_intensity_live(zone)
    gco2 = MOCK_GRID_INTENSITIES.get(zone, 650.0)
    return GridIntensityResponse(zone=zone, gco2_per_kwh=gco2, fetched_at=time.time(), source="mock")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("SIDECAR_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
