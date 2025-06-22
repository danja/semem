# Semem on the server

I just went to do something unrelated with Claude chat in the browser and noticed that I'd already added a pointer to Semem MCP running on localhost. Claude can't see it, so I guess the connection must be made server-side. Ok, let me run Semem MCP on a server. It *should* be doable using `npx semem-mcp`, but I want the whole shebang on the server anyway, so I'll go the long way round.

It should just take :

```sh
cd ~/hyperdata
git clone https://github.com/danja/semem.git
cd semem
npm install
npm run mcp:http
# or node mcp/http-server.js
```

But the version of node I have on the server is a bit old, so:
```sh
sudo npm install n -g
n stable
node --version
# v22.16.0
```

I'd better set it up through the nginx proxy to get https:

```sh
nano /etc/nginx/sites-available/semem.conf
```

```sh
server {
    server_name semem.tensegrity.it;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
    listen 80;
}
```
Add a DNS entry :
```sh
semem 10800 IN CNAME tensegrity.it.
```

```sh
ln -s /etc/nginx/sites-available/semem.conf /etc/nginx/sites-enabled/semem.conf
nginx -t
systemctl restart nginx
certbot
```

Hmm. Bad gateway. Let me try it on port 4600 and make it 127.0.0.1 rather than localhost just in case:
```sh
MCP_PORT=4600 MCP_HOST=127.0.0.1 node mcp/http-server.js
```
Locally :
```sh
curl https://semem.tensegrity.it/health

{"status":"healthy","timestamp":"2025-06-22T10:17:25.243Z","services":{"memoryManager":true,"config":true},"sessions":0}
```
Yay!
