cd /home/user/Mozg/engine/tick/embryo
# ТЕЛО-1: сид, условие
B="BODY=1 DEEP=0 EAT=0 SLOW=0 PAYL=0 ROUNDS=60000 ENG=./nb.js"
case "$2" in M) X="" ;; M0) X="MLR=0" ;; BR) X="BRAIT=20" ;; FM) X="BFIX=1" ;; FM0) X="BFIX=1 MLR=0" ;; FBR) X="BFIX=1 BRAIT=20" ;; esac
T=""; [ "$1" -le 9003 ] && T="TRAJ=out/traj_body1_$2_$1.json"
env $(cat embryo.env) $B $X $T node body1.js $1 $2 >> out/body1.tsv
