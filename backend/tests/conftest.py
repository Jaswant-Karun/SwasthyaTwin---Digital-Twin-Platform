import pytest
import mongomock
from fastapi.testclient import TestClient
from app.main import app
from app.api.deps import get_database

@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    db = client["swasthya_twin_test"]
    yield db
    client.close()

@pytest.fixture
def client(mock_db):
    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
