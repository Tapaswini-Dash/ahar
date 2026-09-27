"""
Import every model here so:
1. Alembic's autogenerate can see the full schema (alembic/env.py imports
   Base.metadata from this package).
2. SQLAlchemy's relationship() string references (e.g. "User", "MealLog")
   resolve correctly no matter which module is imported first.
"""

from app.models.base import Base
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.food_analysis import FoodAnalysis
from app.models.meal_log import MealLog
from app.models.meal_ingredient import MealIngredient
from app.models.packaged_food_log import PackagedFoodLog
from app.models.daily_progress import DailyProgress
from app.models.user_gamification import UserGamification
from app.models.badge import Badge, UserBadge
from app.models.reminder import Reminder

__all__ = [
    "Base",
    "User",
    "UserProfile",
    "FoodAnalysis",
    "MealLog",
    "MealIngredient",
    "PackagedFoodLog",
    "DailyProgress",
    "UserGamification",
    "Badge",
    "UserBadge",
    "Reminder",
]