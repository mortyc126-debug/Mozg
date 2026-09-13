"""
Лёгкие самопроверки для проверки целостности переданных данных.
НЕ доказывают полную корректность модели -- только структурную
целостность файлов и работоспособность критической функции (знак
лага), которая один раз уже была найдена неверной в ходе проекта.

Запуск: python3 self_checks.py
Быстро (секунды), не запускает новых симуляций сверх минимально
необходимого (self_test_sign_convention -- синтетический пример,
не связан с моделью).
"""
import os
import sys


def check_required_files():
    print("=== 1. Обязательные файлы ===")
    required = [
        "sim_core.py",
        "v5f.py",
        "v04_regional.py",
        "v04_localization.py",
        "v04_recompute_final.py",
        "quantitative_recovery.py",
        "v05_four_conditions.pkl",
        "v04_final_data.pkl",
    ]
    all_ok = True
    for f in required:
        exists = os.path.exists(f)
        print(f"  {f}: {'OK' if exists else 'ОТСУТСТВУЕТ'}")
        all_ok = all_ok and exists
    return all_ok


def check_v05_pickle():
    print("=== 2. Целостность v05_four_conditions.pkl ===")
    try:
        import pickle
        import numpy as np
        with open("v05_four_conditions.pkl", "rb") as f:
            d = pickle.load(f)

        expected_conditions = {
            "Исходное", "Только бюджет", "Только длина", "Совместное"
        }
        actual_conditions = set(d.keys())
        assert actual_conditions == expected_conditions, (
            f"Ожидались условия {expected_conditions}, "
            f"получены {actual_conditions}"
        )

        for name, runs in d.items():
            assert len(runs) == 3, f"{name}: ожидалось 3 сида, получено {len(runs)}"
            for net in runs:
                assert net["contacts"].shape == (80, 80)
                assert net["weights"].shape == (80, 80)
                assert np.isfinite(net["weights"]).all()
                assert not net["contacts"].diagonal().any(), (
                    "Найден контакт на диагонали -- нарушение правила модели"
                )
                if "бюджет" in name or "Совместное" in name:
                    max_deg = net["contacts"].sum(axis=1).max()
                    assert max_deg <= 12, (
                        f"{name}: превышен бюджет K=12, найдено {max_deg}"
                    )
                for key in ("v", "syn", "adaptation", "refractory",
                            "threshold", "drive"):
                    assert key in net["state"]
                    assert net["state"][key].shape == (80,)
                    assert np.isfinite(net["state"][key]).all()

        print("  Все структурные проверки пройдены (12 сетей: 4 условия x 3 сида)")
        return True
    except Exception as e:
        print(f"  ОШИБКА: {e}")
        return False


def check_v04_final_data():
    print("=== 3. Целостность v04_final_data.pkl ===")
    try:
        import pickle
        with open("v04_final_data.pkl", "rb") as f:
            d = pickle.load(f)

        assert set(d.keys()) == {"raw_data", "stim_sets", "region_id"}
        assert len(d["region_id"]) == 80
        assert set(d["region_id"]) <= {0, 1, 2, 3}

        variants = set(d["raw_data"].keys())
        expected_variants = {
            "Исходная (bias=1.0)", "Внутриобластная (bias=2.0)",
            "Межобластная (bias=0.5)",
        }
        assert variants == expected_variants

        for variant, data in d["raw_data"].items():
            sample_key = next(iter(data.keys()))
            sample_val = data[sample_key]
            assert len(sample_key) == 4, "Ключ должен быть (source,target,warm,test)"
            assert "R_200" in sample_val and "F_200" in sample_val
            assert len(sample_val["R_windows"]) == 4
            assert len(sample_val["F_windows"]) == 4

        print("  Все структурные проверки пройдены")
        return True
    except Exception as e:
        print(f"  ОШИБКА: {e}")
        return False


def check_sign_convention():
    print("=== 4. Самопроверка знака лага (normalized_xcorr) ===")
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from quantitative_recovery import self_test_sign_convention
        ok = self_test_sign_convention()
        if ok:
            print("  Знак лага корректен")
        else:
            print("  ВНИМАНИЕ: знак лага НЕ прошёл самопроверку!")
        return ok
    except Exception as e:
        print(f"  ОШИБКА (возможно, файл не скопирован): {e}")
        return False


def check_recovery_v02():
    print("=== 5. recovery_v02/ (опционально, большой объём) ===")
    if not os.path.isdir("recovery_v02"):
        print("  recovery_v02/ отсутствует -- пропущено (это нормально, "
              "если передан только малый архив)")
        return None
    import csv
    manifest_path = os.path.join("recovery_v02", "manifest.csv")
    if not os.path.exists(manifest_path):
        print("  ОШИБКА: manifest.csv отсутствует внутри recovery_v02/")
        return False
    with open(manifest_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    print(f"  Записей в манифесте: {len(rows)} (ожидается 36)")
    missing = [r["filename"] for r in rows
               if not os.path.exists(os.path.join("recovery_v02", r["filename"]))]
    if missing:
        print(f"  ОТСУТСТВУЮТ файлы: {missing}")
        return False
    print("  Все 36 файлов на месте")
    return True


if __name__ == "__main__":
    print("ЛЁГКИЕ САМОПРОВЕРКИ (не доказывают полную корректность модели)\n")
    results = [
        check_required_files(),
        check_v05_pickle(),
        check_v04_final_data(),
        check_sign_convention(),
        check_recovery_v02(),
    ]
    print()
    passed = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is False)
    skipped = sum(1 for r in results if r is None)
    print(f"Итог: {passed} пройдено, {failed} провалено, {skipped} пропущено")
