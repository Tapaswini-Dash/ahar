"""Basic app-wide logging setup. Call configure_logging() once from main.py."""

import logging
import sys

from app.core.config import settings


def configure_logging() -> None:
    level = logging.DEBUG if not settings.is_production else logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    # Quiet down noisy third-party loggers
    logging.getLogger("passlib").setLevel(logging.ERROR)
    logging.getLogger("PIL").setLevel(logging.WARNING)