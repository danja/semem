# Semem HTTP Forms Interface

## Overview
Browser-based user interface providing form-based access to Semem functionality. Built with vanilla HTML, CSS, and JavaScript for maximum compatibility.

## Quick Start
Access the interface at `http://localhost:3000/` after starting the Semem server:
```bash
semem server --port 3000 --forms
```

## Features

### Chat Interface
```html
<!-- Basic chat form -->
<form id="chatForm" action="/api/chat" method="POST">
  <textarea name="prompt" required></textarea>
  <select name="model">
    <option value="qwen2:1.5b">Qwen 1.5B</option>
    <option value="llama2">Llama 2</option>
  </select>
  <button type="submit">Send</button>
</form>

<script>
document.getElementById('chatForm').onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  console.log(data.response);
};
</script>
```

### Storage Interface
```html
<!-- Data storage form -->
<form id="storeForm" action="/api/store" method="POST">
  <input type="text" name="content" required>
  <select name="format">
    <option value="text">Text</option>
    <option value="turtle">Turtle</option>
  </select>
  <button type="submit">Store</button>
</form>
```

### Query Interface
```html
<!-- Search form -->
<form id="searchForm" action="/api/query" method="GET">
  <input type="text" name="text" placeholder="Search...">
  <input type="number" name="limit" value="10">
  <button type="submit">Search</button>
</form>

<!-- SPARQL query form -->
<form id="sparqlForm" action="/api/query" method="POST">
  <textarea name="sparql" required></textarea>
  <button type="submit">Execute</button>
</form>
```

### Real-time Updates
```html
<!-- Streaming chat interface -->
<div id="chat">
  <div id="messages"></div>
  <form id="streamForm">
    <input type="text" id="prompt">
    <button type="submit">Send</button>
  </form>
</div>

<script>
const streamChat = async (prompt) => {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  
  const reader = response.body.getReader();
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    const text = new TextDecoder().decode(value);
    document.getElementById('messages').textContent += text;
  }
};
</script>
```

### Metrics Dashboard
```html
<!-- Metrics display -->
<div id="metrics">
  <div id="storage"></div>
  <div id="performance"></div>
  <div id="errors"></div>
</div>

<script>
const updateMetrics = async () => {
  const response = await fetch('/api/metrics');
  const data = await response.json();
  document.getElementById('storage').textContent = 
    `Storage: ${data.storage.size} bytes`;
  // Update other metrics...
};
setInterval(updateMetrics, 5000);
</script>
```

## Styling
The interface uses minimal CSS for responsiveness:
```css
/* Basic responsive layout */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

/* Form styling */
form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 600px;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }
  
  textarea {
    height: 100px;
  }
}
```

## Configuration
Forms interface can be customized through:
- URL parameters
- Local storage settings
- Server-side configuration

Example configuration:
```javascript
{
  "forms": {
    "theme": "light",
    "autoSave": true,
    "refreshInterval": 5000
  }
}
```