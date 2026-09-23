# Собственные числа матриц тишины: на вход -- n и матрицы float64 подряд; на выход -- JSON по каждой.
import sys, json, numpy as np
buf = sys.stdin.buffer.read()
n, k = np.frombuffer(buf[:16], dtype=np.int64)
M = np.frombuffer(buf[16:], dtype=np.float64).reshape(k, n, n)
out = []
for A in M:
    ev, V = np.linalg.eig(A)
    i = int(np.argmax(np.abs(ev)))
    sh = np.abs(V[:, i]) ** 2
    out.append({'r': float(np.abs(ev[i])), 's': float(np.linalg.norm(A, 2)), 'sh': (sh / sh.sum()).tolist()})
print(json.dumps(out))
