from alembic import context
from app.db.session import Base, engine
import app.models  # noqa: register tables

def run():
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=Base.metadata)
        with context.begin_transaction(): context.run_migrations()
run()
