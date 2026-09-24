cd /home/user/Mozg/engine/tick/embryo
echo "===== фаза 1: часы"; cat out/gate96.read
for v in Z1 Z2; do echo "===== $v: батарея"; node readbattery.js out/battery96_$v.tsv 2 | sed -n '/вымерших/,/^8 /p' | grep -v '^$' | grep -v "^1 \|^5 \|^8 "; echo "катастрофы: $(grep ^зародыш out/battery96_$v.tsv | awk -F'\t' '{split($19,a,","); s+=a[1]} END {print s}')"; echo "===== $v: строка 5"; node readsavings96.js out/savings96_$v.tsv 2 | tail -4; done
echo "===== строка 8"; node read96o.js
echo "===== строка 6, вторая половина"; node read96x.js
