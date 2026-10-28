cd /home/user/Mozg/engine/tick/review/v21
C=$1; S=$2
case "$C" in
  А) EXTRA="KEEP=0.9 GAINM=0" ;; Б) EXTRA="KEEP=0.9 GAINM=1" ;;
  В) EXTRA="KEEP=0 GAINM=0" ;;   Г) EXTRA="KEEP=0 GAINM=1" ;;
esac
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 SIG=0.1 SLR=0.002 $EXTRA node run.js "$S" "$C"
