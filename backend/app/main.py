from fastapi import FastAPI

app = FastAPI(
    title="Iuris API",
    description="API de gestión jurídica para el estudio (Laboral y ART).",
    version="0.1.0",
)


@app.get("/health", tags=["infraestructura"])
def health() -> dict[str, str]:
    """Endpoint de salud. Sin auth, sin DB. (RNF-13)"""
    return {"status": "UP"}
