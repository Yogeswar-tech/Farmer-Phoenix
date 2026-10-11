from fastapi import FastAPI

app = FastAPI(title="Kisan Sethu API")


@app.get("/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
