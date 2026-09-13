"""
Автоматическая сборка релизного архива проекта из ЕДИНСТВЕННОГО
источника истины: project/docs, project/code, project/data.

Использование:
    python3 tools/build_release.py <release_name>

Создаёт:
    releases/<release_name>.tar.gz
    releases/<release_name>_MANIFEST.sha256  (хеши ВСЕХ файлов пакета,
        включая документацию -- в отличие от docs/DATA_INDEX.csv,
        который индексирует только код и данные)

Не редактирует docs/code/data -- только читает и упаковывает.
Не запускает никакие симуляции.
"""
import sys
import os
import hashlib
import tarfile
import shutil
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"
CODE_DIR = PROJECT_ROOT / "code"
DATA_DIR = PROJECT_ROOT / "data"
TOOLS_DIR = PROJECT_ROOT / "tools"
RELEASES_DIR = PROJECT_ROOT / "releases"


def sha256_of_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build(release_name):
    RELEASES_DIR.mkdir(exist_ok=True)

    staging = RELEASES_DIR / f"_staging_{release_name}"
    if staging.exists():
        shutil.rmtree(staging)
    (staging / "docs").mkdir(parents=True)
    (staging / "code").mkdir(parents=True)
    (staging / "data").mkdir(parents=True)
    (staging / "tools").mkdir(parents=True)

    manifest_lines = []

    for src_dir, dst_name in (
        (DOCS_DIR, "docs"), (CODE_DIR, "code"), (DATA_DIR, "data"),
        (TOOLS_DIR, "tools"),
    ):
        for f in sorted(src_dir.iterdir()):
            if f.is_file():
                dst = staging / dst_name / f.name
                shutil.copy2(f, dst)
                digest = sha256_of_file(dst)
                size = dst.stat().st_size
                manifest_lines.append(f"{dst_name}/{f.name},{size},{digest}")

    manifest_path = RELEASES_DIR / f"{release_name}_MANIFEST.sha256"
    with open(manifest_path, "w", newline="\n") as f:
        f.write("\n".join(manifest_lines) + "\n")

    archive_path = RELEASES_DIR / f"{release_name}.tar.gz"
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(staging / "docs", arcname="docs")
        tar.add(staging / "code", arcname="code")
        tar.add(staging / "data", arcname="data")
        tar.add(staging / "tools", arcname="tools")

    shutil.rmtree(staging)

    print(f"Собрано: {archive_path} ({archive_path.stat().st_size / 1024 / 1024:.2f} МБ)")
    print(f"Манифест: {manifest_path} ({len(manifest_lines)} файлов, включая tools/)")
    return archive_path, manifest_path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Использование: python3 tools/build_release.py <release_name>")
        sys.exit(1)
    build(sys.argv[1])
