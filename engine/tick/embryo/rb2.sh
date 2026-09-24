cd /home/user/Mozg/engine/tick/embryo
# ТЕЛО-2: сид, размер, условие
B="BODY=2 DEEP=0 EAT=0 SLOW=0 PAYL=0 SPEED=0.2 ROUNDS=80000 PHA=40000 PHB=20000 MG=$2 ENG=./nb.js"
case "$3" in К) X="CUR=1" ;; Т) X="DRK=3" ;; Б) X="" ;; М0) X="CUR=1 MLR=0" ;; СП) X="BWF=1" ;; esac
T=""; [ "$1" -le 9102 ] && T="TRAJ=out/traj_body2_$3_$2_$1.json"
env $(cat embryo.env) $B $X $T node body2.js $1 $3 >> out/body2.tsv
