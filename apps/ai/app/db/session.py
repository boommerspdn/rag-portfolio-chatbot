from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings


def _asyncpg_sqlalchemy_url_and_connect_args(database_url: str) -> tuple[str, dict[str, object]]:
    """asyncpg does not accept libpq query params like sslmode= passed through SQLAlchemy."""
    raw = database_url.strip()
    if raw.startswith("postgresql://") and "+asyncpg" not in raw.split("://", 1)[0]:
        raw = "postgresql+asyncpg://" + raw.removeprefix("postgresql://")
    parsed = urlparse(raw)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    had_sslmode_require_like = False
    drop_keys: list[str] = []
    for key in qs:
        lk = key.lower()
        if lk == "sslmode":
            drop_keys.append(key)
            val = (qs[key][0] if qs[key] else "").lower()
            if val in ("require", "verify-ca", "verify-full", "allow", "prefer"):
                had_sslmode_require_like = True
        elif lk in ("channel_binding", "gssencmode"):
            drop_keys.append(key)
    for k in drop_keys:
        del qs[k]
    new_query = urlencode(qs, doseq=True)
    url_out = urlunparse(parsed._replace(query=new_query))
    connect_args: dict[str, object] = {}
    host = (parsed.hostname or "").lower()
    if had_sslmode_require_like or "neon.tech" in host or host.endswith(".neon.cloud"):
        connect_args["ssl"] = True
    return url_out, connect_args


_url, _connect_args = _asyncpg_sqlalchemy_url_and_connect_args(settings.database_url)
engine = create_async_engine(
    _url,
    echo=False,
    connect_args=_connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
