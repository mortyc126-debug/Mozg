import json,sys
rows=[]
for l in open(sys.argv[1]):
  r=json.loads(l); res=r['res']; v=res.get('acc', res.get('chain', res.get('transfer', res.get('held', res.get('ok')))))
  rows.append((r['test'],r['size'],r['seed'],round(v,2), round(r['ops']/1000)))
for x in sorted(rows): print(*x)
