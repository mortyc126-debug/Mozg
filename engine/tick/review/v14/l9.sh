cd /home/user/Mozg/engine/tick/review/v14
env DEEP=2 node cmp.js lms9.js $1 | sed "s/^/lms9\t/"
