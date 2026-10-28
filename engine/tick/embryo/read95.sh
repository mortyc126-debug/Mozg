cd /home/user/Mozg/engine/tick/embryo
for v in U1 U2; do echo "===== $v: батарея"; node readbattery.js out/battery95_$v.tsv 2 | sed -n '/вымерших/,/^8 /p' | grep -v '^$' | grep -v "^1 \|^5 \|^8 "; echo "катастрофы: $(grep ^зародыш out/battery95_$v.tsv | awk -F'\t' '{split($19,a,","); s+=a[1]} END {print s}')"; echo "===== $v: строка 5"; node readsavings86.js out/savings95_$v.tsv | tail -4; done
echo "===== строка 8"; node read95o.js
echo "===== строка 6, вторая половина"; node read95x.js
