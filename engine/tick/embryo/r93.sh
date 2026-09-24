cd /home/user/Mozg/engine/tick/embryo
case "$1" in Xm) X="HQ=0.005 LOOKN=30 LLEARN=1" ;; Ym) X="HQ=0.05 LOOKN=100 LLEARN=1" ;; X0) X="HQ=0.005 LOOKN=30 LLEARN=0" ;; Y0) X="HQ=0.05 LOOKN=100 LLEARN=0" ;; esac
env $(cat embryo.env) HID=1 LOOK=0.8 LLMIX=1 $X node run92.js $2 $1 >> out/exp93.tsv
