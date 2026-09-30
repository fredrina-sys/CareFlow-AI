import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.db.session import Base, get_db
import app.models
from app.main import app
from scripts.seed import seed, DEMO_PASSWORD

@pytest.fixture()
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng); S = sessionmaker(bind=eng, autoflush=False)
    with S() as s:
        seed(s); yield s

@pytest.fixture()
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app); app.dependency_overrides.clear()

@pytest.fixture()
def login(client):
    def _(email):
        r = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD}); assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}
    return _
