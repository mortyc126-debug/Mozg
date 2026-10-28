cd /home/user/Mozg/engine/tick/review/v20
C=$1; S=$2
case "$C" in
  А) EXTRA="GAINM=0 LAG=0" ;; Б) EXTRA="GAINM=1 LAG=0" ;;
  В) EXTRA="GAINM=0 LAG=1" ;; Г) EXTRA="GAINM=1 LAG=1" ;;
esac
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 SIG=0.1 SLR=0.002 $EXTRA node run.js "$S" "$C"
