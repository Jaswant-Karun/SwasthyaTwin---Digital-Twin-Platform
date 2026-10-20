import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "SwasthyaTwin"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    
    # MongoDB
    MONGODB_URI: str = Field(default="mongodb://localhost:27017", env="MONGODB_URI")
    MONGODB_DATABASE: str = Field(default="swasthya_twin", env="MONGODB_DATABASE")
    ALLOW_IN_MEMORY_FALLBACK: bool = Field(default=True, env="ALLOW_IN_MEMORY_FALLBACK")
    
    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
        env="CORS_ORIGINS"
    )
    
    # Analytics
    DEFAULT_BASELINE_DAYS: int = Field(default=30, env="DEFAULT_BASELINE_DAYS")
    DEVIATION_SIGMA_THRESHOLD: float = Field(default=2.0, env="DEVIATION_SIGMA_THRESHOLD")
    ENABLE_SYNTHETIC_AUTOSEED: bool = Field(default=True, env="ENABLE_SYNTHETIC_AUTOSEED")

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
