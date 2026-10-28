cd /home/user/Mozg/engine/tick/review/v28
case "$1" in
  Г0) EXTRA="SELFREC=0" ;;
  Г1) EXTRA="SELFREC=1 WSLEARN=0 WS0=0 WS0S=0.82" ;;
  Г2) EXTRA="SELFREC=1 WSLEARN=0 WS0=0.82 WS0S=0.82" ;;
esac
env DEEP=2 EAT=0 SLOW=1 $EXTRA node gate.js $2 $1
