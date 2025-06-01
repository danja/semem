
## Build Postcraft

```sh
cd ~/hyperdata/transmissions # my local path
# ./del-dan.sh
./trans postcraft-statics ~/hyperdata/semem/docs/postcraft
./trans md-to-sparqlstore ~/hyperdata/semem/docs/postcraft
./trans sparqlstore-to-html ~/hyperdata/semem/docs/postcraft
./trans sparqlstore-to-site-indexes ~/hyperdata/semem/docs/postcraft
```

