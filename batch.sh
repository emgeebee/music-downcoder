#!/bin/sh
shopt -s extglob
IFS=$'\n'
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
printf "%s\n" ${DIR}
cd ${DIR}
for file in `find ./cmd/${1} -name "*.sh"`
do
	if [ -a ${file} ]; then
		filename=$(basename "$file")
		mv ${file} ./queueInProgress/${filename}
		time=$(date +%k%M)
		#echo ${time} "${filename}"
		#if [[ "$time" -le 2359 ]];then
			sh "./queueInProgress/${filename}"
		    rm "./queueInProgress/${filename}"
		    sleep 60
		#else
		#exit 0
		#fi
	fi
done



#queue.sh >> logs/queueoutput_$(date +%Y%m%d).txt 2>&1
