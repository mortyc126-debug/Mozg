cd /home/user/Mozg/engine/tick/embryo
env $(cat embryo.env) HID=1 HQ=$1 LOOK=0.8 LOOKN=$2 LOSEK=0 node run90.js $3 "HQ=$1 n=$2" >> out/gate90.tsv
