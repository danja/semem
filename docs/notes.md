 lsof -ti:6277 | xargs kill -9 

  fuser -k 6277/tcp 

 lsof -i:6277

   netstat -tulpn | grep 6277

kill -9

