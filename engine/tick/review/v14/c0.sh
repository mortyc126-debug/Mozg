cd /home/user/Mozg/engine/tick/review/v14
env DEEP=2 node cmp.js c0.js $1 | sed "s/^/c0\t/"
