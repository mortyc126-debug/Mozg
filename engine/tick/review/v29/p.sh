cd /home/user/Mozg/engine/tick/review/v29
case "$1" in
  Г0) EXTRA="SELFREC=0" ;;
  Г1) EXTRA="SELFREC=1 WSLEARN=0 WS0=0 WS0S=0.82" ;;
  Г3) EXTRA="SELFREC=1 WSLEARN=0 WS0=0 WS0S=0.82 SPROTECT=1" ;;
  Г0з) EXTRA="SELFREC=0 SPROTECT=1" ;;
esac
env DEEP=2 EAT=0 SLOW=1 $EXTRA node poor.js $2 $1
