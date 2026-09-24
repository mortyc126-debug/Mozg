cd /home/user/Mozg/engine/tick/embryo
case "$1" in X*) W="HQ=0.005 LOOKN=30" ;; Y*) W="HQ=0.05 LOOKN=100" ;; esac
case "$1" in ?L1) X="LLEARN=1 LLSIDE=1" ;; ?L0) X="LLEARN=1 LLSIDE=0" ;; ?N1) X="LLEARN=0 LLSIDE=1" ;; ?N0) X="LLEARN=0 LLSIDE=0" ;; esac
env $(cat embryo.env) HID=1 LOOK=0.8 LLMIX=1 $W $X node run92.js $2 $1 >> out/exp94.tsv
