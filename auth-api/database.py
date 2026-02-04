"""SQLAlchemy 引擎与会话，启动时创建表"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings
from models import Base

_url = settings.DATABASE_URL.strip().lower()
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    _ensure_user_status_columns()
    _ensure_trials_table()
def _ensure_trials_table():
    """SQLite：创建 trials 表（id, username UNIQUE, start_ts, end_ts），供 POST /auth/trial/start 使用。"""
    if not _url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS trials("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, start_ts INTEGER, end_ts INTEGER)"
            )
        )
def _ensure_user_status_columns():
    """SQLite：为 users 表补列 plan/status/created_at/trial_*（如不存在）；对已有用户补默认值。不引入迁移系统。"""
    if not _url.startswith("sqlite"):
        return
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'")
        ).fetchone()
        if not exists:
            return
        result = conn.execute(text("PRAGMA table_info(users)"))
        rows = result.fetchall()
        columns = [row[1] for row in rows] if rows else []
        if "created_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN created_at TEXT"))
            conn.execute(text("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL OR created_at = ''"))
        if "status" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'"))
            conn.execute(text("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''"))
        if "plan" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'"))
        if "trial_start_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN trial_start_at TEXT"))
        if "trial_end_at" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN trial_end_at TEXT"))
        # 老数据补 created_at
        conn.execute(
            text(
                "UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL OR created_at = ''"
            )
        )