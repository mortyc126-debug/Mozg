cd /home/user/Mozg/engine/tick/review/v30
case "$1" in
  О0) EXTRA="PAYL=0 SELFREC=0" ;;
  О1) EXTRA="PAYL=1 SELFREC=0" ;;
  О2) EXTRA="PAYL=1 SELFREC=1 WSLEARN=1 WS0=0 WS0S=0" ;;
  О3) EXTRA="PAYL=1 SELFREC=1 WSLEARN=0 WS0=0 WS0S=0.82" ;;
  О4) EXTRA="PAYL=0 SELFREC=1 WSLEARN=1 WS0=0 WS0S=0" ;;
esac
env DEEP=2 EAT=0 SLOW=1 $EXTRA node run.js $2 $1
