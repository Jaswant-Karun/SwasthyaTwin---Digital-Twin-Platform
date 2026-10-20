import logging
from typing import Optional, Dict, Any
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, PyMongoError
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
        self.is_connected: bool = False
        self.is_fallback: bool = False
        self.connection_error: Optional[str] = None

    def connect(self) -> None:
        """
        Attempt to connect to primary MongoDB instance.
        Never logs credentials; masks URI.
        Falls back to in-memory mongomock only if explicitly enabled.
        """
        masked_uri = settings.sanitized_mongo_uri
        try:
            logger.info(f"Connecting to primary MongoDB: {masked_uri} [DB: {settings.MONGODB_DATABASE}]")
            # 2.5s connect and server selection timeout so startup check fails fast if host is unreachable
            client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2500,
                connectTimeoutMS=2500
            )
            # Ping command for active readiness validation
            client.admin.command('ping')
            self._client = client
            self._db = client[settings.MONGODB_DATABASE]
            self.is_connected = True
            self.is_fallback = False
            self.connection_error = None
            logger.info(f"Successfully established verified MongoDB connection to database: '{settings.MONGODB_DATABASE}'")
        except (ConnectionFailure, ServerSelectionTimeoutError, PyMongoError, Exception) as e:
            # Clean non-sensitive error logging
            err_type = type(e).__name__
            self.connection_error = f"{err_type}: Connection to MongoDB could not be established."
            logger.warning(f"MongoDB connection failed: {self.connection_error}")

            if settings.ALLOW_IN_MEMORY_FALLBACK:
                logger.warning("Initializing in-memory isolated demonstration store (mongomock)...")
                try:
                    import mongomock
                    self._client = mongomock.MongoClient()
                    self._db = self._client[settings.MONGODB_DATABASE]
                    self.is_connected = True
                    self.is_fallback = True
                    logger.info("In-memory isolated demonstration store initialized successfully.")
                except ImportError:
                    logger.error("mongomock package not found. Database connection remains offline.")
                    self.is_connected = False
            else:
                self.is_connected = False
                logger.error("ALLOW_IN_MEMORY_FALLBACK is False. Primary database is offline.")

    def get_database(self) -> Database:
        if self._db is None or not self.is_connected:
            self.connect()
        if self._db is None or not self.is_connected:
            raise RuntimeError(f"Primary MongoDB database unavailable: {self.connection_error}")
        return self._db

    def check_readiness(self) -> Dict[str, Any]:
        """Performs a live readiness ping check."""
        if not self._client or not self.is_connected:
            return {"ready": False, "reason": "No active client connection"}
        try:
            if not self.is_fallback:
                self._client.admin.command('ping')
            return {
                "ready": True,
                "engine": "in_memory_mock" if self.is_fallback else "mongodb_official_driver",
                "database": settings.MONGODB_DATABASE,
                "fallback_active": self.is_fallback
            }
        except Exception as e:
            return {"ready": False, "reason": f"Ping failure: {type(e).__name__}"}

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            self.is_connected = False
            logger.info("MongoDB connection closed.")

db_manager = DatabaseManager()

def get_db() -> Database:
    return db_manager.get_database()
