curl -X POST \
  -H "Authorization: Basic $(echo -n 'admin:admin123' | base64)" \
  -H "Content-Type: text/turtle" \
  --data-binary '@-' \
  'http://localhost:4030/test/data?graph=http://example.org/test-graph' << 'EOF'
@prefix ex: <http://example.org/> .
ex:subject ex:predicate "test value" .
EOF