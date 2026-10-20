from typing import Generator
from pymongo.database import Database
from app.database.connection import get_db

def get_database() -> Generator[Database, None, None]:
    db = get_db()
    try:
        yield db
    finally:
        pass
