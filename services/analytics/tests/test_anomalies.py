import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def mesa(key: str, municipio: str, sufragantes: int, total: int, votos: dict):
    return {
        "ubicacion_key": key,
        "municipio": municipio,
        "total_sufragantes": sufragantes,
        "total_votos": total,
        "votos_por_candidato": votos,
    }


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_sin_anomalias():
    mesas = [mesa(f"76-001-01-01-0{i}", "Cali", 300, 250, {"A": 130, "B": 120}) for i in range(5)]
    r = client.post("/anomalies/detect", json=mesas)
    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.json()]
    assert "PARTICIPACION_ATIPICA" not in tipos


def test_participacion_atipica():
    # 8 mesas con ~50% participación + 1 mesa con 100%
    # diferencia lo suficientemente grande para superar 2σ con n=9
    mesas = [mesa(f"76-001-01-01-0{i}", "Cali", 300, 150, {"A": 80, "B": 70}) for i in range(8)]
    mesas.append(mesa("76-001-01-01-99", "Cali", 300, 300, {"A": 160, "B": 140}))
    r = client.post("/anomalies/detect", json=mesas)
    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.json()]
    assert "PARTICIPACION_ATIPICA" in tipos


def test_concentracion_extrema():
    mesas = [mesa("76-001-01-01-01", "Cali", 300, 300, {"A": 299, "B": 1})]
    r = client.post("/anomalies/detect", json=mesas)
    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.json()]
    assert "CONCENTRACION_EXTREMA" in tipos


def test_secuencia_total_identico():
    mesas = [mesa(f"76-001-01-01-0{i}", "Cali", 300, 247, {"A": 130, "B": 117}) for i in range(5)]
    r = client.post("/anomalies/detect", json=mesas)
    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.json()]
    assert "SECUENCIA_TOTAL_IDENTICO" in tipos
