"""
Проверка распакованного пакета против MANIFEST.sha256, собранного
build_release.py. Использование:

    python3 tools/verify_manifest.py <path_to_extracted_package> <manifest.sha256>

Печатает несовпадения (изменённые/отсутствующие/лишние файлы) и код
возврата 0 при полном совпадении, 1 при любом расхождении.
"""
import sys
import hashlib
from pathlib import Path


def sha256_of_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(package_dir, manifest_path):
    package_dir = Path(package_dir)
    expected = {}
    with open(manifest_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rel_path, size, digest = line.rsplit(",", 2)
            expected[rel_path] = (int(size), digest)

    ok = True
    for rel_path, (exp_size, exp_digest) in expected.items():
        full_path = package_dir / rel_path
        if not full_path.exists():
            print(f"ОТСУТСТВУЕТ: {rel_path}")
            ok = False
            continue
        actual_size = full_path.stat().st_size
        actual_digest = sha256_of_file(full_path)
        if actual_size != exp_size or actual_digest != exp_digest:
            print(f"НЕСОВПАДЕНИЕ: {rel_path} "
                  f"(размер {actual_size} vs {exp_size}, "
                  f"hash {'совпадает' if actual_digest==exp_digest else 'НЕ совпадает'})")
            ok = False

    actual_files = set()
    for sub in ("docs", "code", "data", "tools"):
        subdir = package_dir / sub
        if subdir.exists():
            for f in subdir.iterdir():
                if f.is_file():
                    actual_files.add(f"{sub}/{f.name}")
    extra = actual_files - set(expected.keys())
    for e in sorted(extra):
        print(f"ЛИШНИЙ ФАЙЛ (не в манифесте): {e}")

    if ok and not extra:
        print(f"OK: все {len(expected)} файлов совпадают с манифестом")
        return 0
    else:
        print("ЕСТЬ РАСХОЖДЕНИЯ -- см. выше")
        return 1


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Использование: python3 tools/verify_manifest.py <package_dir> <manifest.sha256>")
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
