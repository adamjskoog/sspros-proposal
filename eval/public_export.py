"""Public exports are restricted to a reviewed set of fictional input fixtures."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).parent
MANIFEST = HERE / "public-fixtures.json"


def assert_public_export(rows: list[dict], meta: dict) -> None:
    if meta.get("data_classification") != "authored-fictional":
        raise ValueError("Public export requires explicitly classified fictional data.")
    approved = json.loads(MANIFEST.read_text(encoding="utf-8"))
    seen = set()
    for row in rows:
        digest = hashlib.sha256(row["inquiry"].encode("utf-8")).hexdigest()
        if row["id"] in seen or approved.get(row["id"]) != digest:
            raise ValueError("Public export rejected: inquiry is not an approved fictional fixture.")
        seen.add(row["id"])


def file_hash(path: Path) -> str:
    """Hash UTF-8 source text with LF endings so Git/Windows checkout conversion is immaterial."""
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()
