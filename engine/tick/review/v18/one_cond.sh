cd /home/user/Mozg/engine/tick/review/v18
C=$1; S=$2
case "$C" in
  петля)  EXTRA="" ;;
  нульА)  EXTRA="RANDACT=1" ;;
  нульБ)  EXTRA="SHUFACT=1" ;;
  нульВ)  EXTRA="LOOP=0" ;;
esac
env DEEP=2 EAT=1 LOOP=0.5 FOOD=10 ACT=0.8 M=4 ROUNDS=100000 $EXTRA node run.js "$S" "$C"
