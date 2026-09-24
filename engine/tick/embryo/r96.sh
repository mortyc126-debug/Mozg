cd /home/user/Mozg/engine/tick/embryo
# шаг 96 (PRE96_BLIND.md): мир Z -- сдвиги по всем осям проб; вариант Z1 или Z2
V=$1; shift
case "$V" in Z1) W="HQ=0.002" ;; Z2) W="HQ=0.02" ;; esac
U="ORDER=1 HID=1 LOOK=0.5 SRHO=0.99 SSIG=1.5 DEEP=3 OGMAX=4 ODMAX=3 $W"
case "$1" in
  g) env $(cat embryo.env) $U LOOKN=$2 LLEARN=0 LOSEK=0 node run90.js $3 "$V n=$2" >> out/gate96.tsv ;;
  b) env $(cat embryo.env) $U $4 node battery.js $2 $3 >> out/battery96_$V.tsv ;;
  o) env $(cat embryo.env) $U $4 node order.js $2 $3 >> out/order96_$V.tsv ;;
  s) env $(cat embryo.env) $U SAVI=1 LABEL=$2 PERTURB=$3 node savings.js $4 $5 $6 $7 >> out/savings96_$V.tsv ;;
  x) CL=$(grep "^$V " out/clocks96.txt | cut -d' ' -f2)
     case "$3" in L1) X="LLEARN=1 LLSIDE=1" ;; L0) X="LLEARN=1 LLSIDE=0" ;; N1) X="LLEARN=0 LLSIDE=1" ;; N0) X="LLEARN=0 LLSIDE=0" ;; esac
     env $(cat embryo.env) $U LLMIX=1 LOOKN=$CL $X node run92.js $2 $3 >> out/cross96_$V.tsv ;;
esac
