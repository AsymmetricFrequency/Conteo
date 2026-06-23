from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import anomalies

app = FastAPI(
    title="Conteo Analytics",
    description="Detección de anomalías estadísticas en formularios E-14",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(anomalies.router, prefix="/anomalies", tags=["Anomalías"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "conteo-analytics"}
