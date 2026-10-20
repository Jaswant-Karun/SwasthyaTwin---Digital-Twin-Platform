import os
import re
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "SwasthyaTwin"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment Configuration (supporting APP_ENV and ENVIRONMENT)
    APP_ENV: str = Field(
        default="development",
        validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT")
    )
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEMO_MODE: bool = True
    
    # MongoDB Configuration
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = Field(
        default="swasthyatwin",
        validation_alias=AliasChoices("MONGODB_DATABASE")
    )
    ALLOW_IN_MEMORY_FALLBACK: bool = True
    
    # CORS Configuration
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    
    # Optional Security / Auth Key
    API_SECRET_KEY: Optional[str] = None
    
    # Analytics Defaults
    DEFAULT_BASELINE_DAYS: int = 30
    DEVIATION_SIGMA_THRESHOLD: float = 2.0
    ENABLE_SYNTHETIC_AUTOSEED: bool = False # Do not delete or overwrite user data automatically during startup

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def sanitized_mongo_uri(self) -> str:
        """Returns MONGODB_URI with username and password sanitized for safe logging."""
        if not self.MONGODB_URI:
            return ""
        # Mask password in mongodb:// or mongodb+srv:// URIs
        return re.sub(r'://([^:]+):([^@]+)@', r'://\1:****@', self.MONGODB_URI)

settings = Settings()
