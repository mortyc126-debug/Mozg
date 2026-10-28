cd /home/user/Mozg/engine/tick/embryo
xargs -P 4 -L 1 bash r96.sh < out/jobs96a.txt 2>> out/run96.err
node read96g.js > out/gate96.read
xargs -P 4 -L 1 bash r96.sh < out/jobs96x.txt 2>> out/run96.err
echo done > out/run96.done
