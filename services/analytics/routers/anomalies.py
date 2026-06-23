"""
Detección de anomalías estadísticas en conjuntos de mesas.

Métricas implementadas (fase 1, deterministas):
  - z-score de participación por municipio
  - concentración extrema de votos (candidato > umbral del total)
  - secuencias de totales idénticos entre mesas vecinas

Estos son insumos para revisión humana, no veredictos.
"""

from __future__ import annotations

from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Body
from pydantic import BaseModel, Field

router = APIRouter()


class MesaInput(BaseModel):
    ubicacion_key: str
    municipio: str
    total_sufragantes: int
    total_votos: int
    votos_por_candidato: dict[str, int]


class AnomalyResult(BaseModel):
    ubicacion_key: str
    municipio: str
    tipo: str
    descripcion: str
    valor: float
    umbral: float
    severidad: str  # BAJA | MEDIA | ALTA


@router.post("/detect", response_model=list[AnomalyResult])
def detect(
    mesas: Annotated[list[MesaInput], Body(min_length=1)],
) -> list[AnomalyResult]:
    """
    Recibe un lote de mesas y devuelve anomalías estadísticas detectadas.
    Mínimo recomendado: ≥ 5 mesas del mismo municipio para z-scores útiles.
    """
    df = pd.DataFrame([m.model_dump() for m in mesas])
    results: list[AnomalyResult] = []

    # 1. Z-score de participación (votos / sufragantes) por municipio.
    df["participacion"] = df["total_votos"] / df["total_sufragantes"].replace(0, pd.NA)
    for municipio, grupo in df.groupby("municipio"):
        if len(grupo) < 3:
            continue
        mu = grupo["participacion"].mean()
        sigma = grupo["participacion"].std()
        if sigma == 0:
            continue
        for _, row in grupo.iterrows():
            z = abs((row["participacion"] - mu) / sigma)
            if z >= 2.0:
                results.append(
                    AnomalyResult(
                        ubicacion_key=str(row["ubicacion_key"]),
                        municipio=str(municipio),
                        tipo="PARTICIPACION_ATIPICA",
                        descripcion=(
                            f"Participación {row['participacion']:.1%} difiere "
                            f"{z:.1f}σ de la media municipal ({mu:.1%})."
                        ),
                        valor=round(z, 2),
                        umbral=2.0,
                        severidad="ALTA" if z >= 3.0 else "MEDIA",
                    )
                )

    # 2. Concentración extrema: un candidato con > 95 % de los votos.
    CONCENTRACION_UMBRAL = 0.95
    for _, row in df.iterrows():
        candidatos: dict = row["votos_por_candidato"]  # type: ignore[assignment]
        total = row["total_votos"]
        if total == 0:
            continue
        for candidato, votos in candidatos.items():
            ratio = votos / total
            if ratio > CONCENTRACION_UMBRAL:
                results.append(
                    AnomalyResult(
                        ubicacion_key=str(row["ubicacion_key"]),
                        municipio=str(row["municipio"]),
                        tipo="CONCENTRACION_EXTREMA",
                        descripcion=(
                            f"Candidato '{candidato}' tiene {ratio:.1%} de los "
                            f"votos en esta mesa (umbral: {CONCENTRACION_UMBRAL:.0%})."
                        ),
                        valor=round(ratio, 4),
                        umbral=CONCENTRACION_UMBRAL,
                        severidad="ALTA",
                    )
                )

    # 3. Secuencias de totales idénticos entre ≥ 3 mesas seguidas.
    MINIMA_SECUENCIA = 3
    totales = df["total_votos"].tolist()
    i = 0
    while i < len(totales):
        j = i + 1
        while j < len(totales) and totales[j] == totales[i]:
            j += 1
        if j - i >= MINIMA_SECUENCIA:
            bloque = df.iloc[i:j]
            results.append(
                AnomalyResult(
                    ubicacion_key=str(bloque.iloc[0]["ubicacion_key"]),
                    municipio=str(bloque.iloc[0]["municipio"]),
                    tipo="SECUENCIA_TOTAL_IDENTICO",
                    descripcion=(
                        f"{j - i} mesas consecutivas con exactamente "
                        f"{int(totales[i])} votos totales."
                    ),
                    valor=float(j - i),
                    umbral=float(MINIMA_SECUENCIA),
                    severidad="MEDIA",
                )
            )
        i = j

    return results
