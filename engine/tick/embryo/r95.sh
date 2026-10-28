cd /home/user/Mozg/engine/tick/embryo
V=$1; shift
case "$V" in U1) W="HQ=0.005"; CL=30 ;; U2) W="HQ=0.05"; CL=100 ;; esac
U="ORDER=1 HID=1 LOOK=0.8 $W"
case "$1" in
  b) env $(cat embryo.env) $U $4 node battery.js $2 $3 >> out/battery95_$V.tsv ;;
  o) env $(cat embryo.env) $U $4 node order.js $2 $3 >> out/order95_$V.tsv ;;
  s) env $(cat embryo.env) $U LABEL=$2 PERTURB=$3 node savings.js $4 $5 $6 $7 >> out/savings95_$V.tsv ;;
  x) case "$3" in L1) X="LLEARN=1 LLSIDE=1" ;; L0) X="LLEARN=1 LLSIDE=0" ;; N1) X="LLEARN=0 LLSIDE=1" ;; N0) X="LLEARN=0 LLSIDE=0" ;; esac
     env $(cat embryo.env) $U LLMIX=1 LOOKN=$CL $X node run92.js $2 $3 >> out/cross95_$V.tsv ;;
esac
