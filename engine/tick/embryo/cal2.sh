cd /home/user/Mozg/engine/tick/embryo
B="BODY=2 DEEP=0 EAT=0 SLOW=0 PAYL=0 SPEED=0.2 ROUNDS=40000 PHA=40000 ENG=./nb.js"
env $(cat embryo.env) $B ${3//_/ } node body2.js $1 $2 | awk -F'\t' '{print $1, $2, "мотор", $16, $17, "доход", $18}' >> out/cal_body2.txt
