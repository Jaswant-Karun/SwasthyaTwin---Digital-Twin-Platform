import logging
from typing import Optional, Any
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
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
        """Attempt to connect to real MongoDB. Fall back gracefully to mongomock if allowed."""
        try:
            logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
            # Set short timeout so startup check doesn't hang if Mongo is offline
            client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=2000
            )
            # Safe startup ping check
            client.admin.command('ping')
            self._client = client
            self._db = client[settings.MONGODB_DATABASE]
            self.is_connected = True
            self.is_fallback = False
            self.connection_error = None
            logger.info(f"Successfully connected to MongoDB database: {settings.MONGODB_DATABASE}")
        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
            error_msg = f"MongoDB connection failed: {str(e)}"
            self.connection_error = error_msg
            logger.warning(error_msg)

            if settings.ALLOW_IN_MEMORY_FALLBACK:
                logger.warning("Initializing in-memory mongomock fallback database for demonstration / test execution...")
                try:
                    import mongomock
                    self._client = mongomock.MongoClient()
                    self._db = self._client[settings.MONGODB_DATABASE]
                    self.is_connected = True
                    self.is_fallback = True
                    logger.info("In-memory mongomock database initialized successfully.")
                except ImportError:
                    logger.error("mongomock is not installed. Database connection remains offline.")
                    self.is_connected = False
            else:
                self.is_connected = False
                logger.error("ALLOW_IN_MEMORY_FALLBACK is False. Service running without active database connection.")

    def get_database(self) -> Database:
        if self._db is None:
            self.connect()
        if self._db is None:
            raise RuntimeError(f"Database unavailable: {self.connection_error}")
        return self._db

    def close(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
            self._db = None
            self.is_connected = False
            logger.info("Database connection closed.")

db_manager = DatabaseManager()

def get_db() -> Database:
    return db_manager.get_database()
