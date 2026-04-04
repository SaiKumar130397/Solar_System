#!/usr/bin/env python3
"""Load planets from planets.json into PostgreSQL."""

import json
import os
import sys
from pathlib import Path

import psycopg

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS planets (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    image       TEXT NOT NULL,
    velocity    INTEGER NOT NULL,
    distance    INTEGER NOT NULL
);
"""

UPSERT_SQL = """
INSERT INTO planets (id, name, description, image, velocity, distance)
VALUES (%(id)s, %(name)s, %(description)s, %(image)s, %(velocity)s, %(distance)s)
ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    image       = EXCLUDED.image,
    velocity    = EXCLUDED.velocity,
    distance    = EXCLUDED.distance;
"""


def _connection_info() -> str | dict[str, object]:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url

    user = os.environ.get("POSTGRES_USER")
    password = os.environ.get("POSTGRES_PASSWORD", "")
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    dbname = os.environ.get("POSTGRES_DB", "postgres")

    if not user:
        print(
            "Missing database config: set DATABASE_URL or POSTGRES_USER (and optionally "
            "POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB).",
            file=sys.stderr,
        )
        sys.exit(1)

    return {
        "host": host,
        "port": int(port),
        "dbname": dbname,
        "user": user,
        "password": password,
    }


def load_planets(json_path: Path) -> list[dict]:
    rows = json.loads(json_path.read_text())
    if not isinstance(rows, list):
        raise ValueError("planets.json must be a JSON array")
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("each planet must be a JSON object")
        for key in ("id", "name", "description", "image", "velocity", "distance"):
            if key not in row:
                raise ValueError(f"missing required field {key!r} in planet {row!r}")
    return rows


def migrate(json_path: Path) -> int:
    rows = load_planets(json_path)
    info = _connection_info()

    if isinstance(info, dict):
        conn_cm = psycopg.connect(**info)
    else:
        conn_cm = psycopg.connect(info)

    with conn_cm as conn:
        conn.execute(CREATE_TABLE_SQL)
        with conn.cursor() as cur:
            for row in rows:
                cur.execute(
                    UPSERT_SQL,
                    {
                        "id": int(row["id"]),
                        "name": row["name"],
                        "description": row["description"],
                        "image": row["image"],
                        "velocity": int(row["velocity"]),
                        "distance": int(row["distance"]),
                    },
                )
        conn.commit()

    return len(rows)


def main() -> None:
    default_json = Path(__file__).resolve().parent / "planets.json"
    path = Path(os.environ.get("PLANETS_JSON_PATH", default_json))
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    count = migrate(path)
    print(f"Migrated {count} planet(s) into PostgreSQL.")


if __name__ == "__main__":
    main()
