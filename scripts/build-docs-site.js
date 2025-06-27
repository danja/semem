#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Create the documentation site structure for GitHub Pages
const siteDir = '_site';

// Ensure site directory exists
if (!fs.existsSync(siteDir)) {
  fs.mkdirSync(siteDir, { recursive: true });
}

// Create main index.html
const mainIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Semem Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 3rem;
      border-bottom: 1px solid #eee;
      padding-bottom: 2rem;
    }
    .nav-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin: 2rem 0;
    }
    .nav-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
    }
    .nav-card:hover {
      border-color: #0066cc;
      box-shadow: 0 2px 8px rgba(0,102,204,0.1);
      transform: translateY(-2px);
    }
    .nav-card h3 {
      margin: 0 0 0.5rem 0;
      color: #0066cc;
    }
    .nav-card p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }
    .footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #eee;
      color: #666;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Semem Documentation</h1>
    <p>Semantic Web Memory for Intelligent Agents</p>
  </div>
  
  <div class="nav-grid">
    <a href="manual/" class="nav-card">
      <h3>📖 User Manual</h3>
      <p>Complete user documentation covering configuration, protocols, knowledge graphs and knowledge graph navigation</p>
    </a>
    
    <a href="api/" class="nav-card">
      <h3>🔧 API Reference</h3>
      <p>Auto-generated JSDoc API documentation for developers and integrators</p>
    </a>
  </div>
  
  <div class="nav-grid">
    <a href="https://github.com/danja/semem" class="nav-card">
      <h3>📦 GitHub Repository</h3>
      <p>Source code, examples, and issue tracking</p>
    </a>
    
    <a href="https://tensegrity.it" class="nav-card">
      <h3>📝 Development Blog</h3>
      <p>Updates, research insights, and technical articles</p>
    </a>
  </div>
  
  <div class="footer">
    <p>Semem - Intelligent semantic memory for the AI age</p>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(siteDir, 'index.html'), mainIndexHtml);

// Create manual index.html wrapper
const manualIndexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Semem Manual</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      line-height: 1.6;
      color: #24292f;
      background-color: #ffffff;
    }
    .github-markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }
    .loading {
      text-align: center;
      padding: 2rem;
      color: #656d76;
    }
    .nav-bar {
      background: #f6f8fa;
      border-bottom: 1px solid #d1d9e0;
      padding: 1rem;
      margin-bottom: 2rem;
    }
    .nav-bar a {
      color: #0969da;
      text-decoration: none;
      margin-right: 1rem;
    }
    .nav-bar a:hover {
      text-decoration: underline;
    }
  </style>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div class="nav-bar">
    <a href="../">← Documentation Home</a>
    <a href="../api/">API Reference</a>
    <a href="https://github.com/danja/semem">GitHub</a>
  </div>
  
  <div class="github-markdown-body" id="content">
    <div class="loading">Loading manual...</div>
  </div>
  
  <script>
    async function loadManual() {
      try {
        const response = await fetch('index.md');
        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        const markdown = await response.text();
        document.getElementById('content').innerHTML = marked.parse(markdown);
        
        // Update relative links to work with GitHub Pages
        const links = document.querySelectorAll('a[href$=".md"]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('..')) {
            link.setAttribute('href', href.replace('.md', '.html'));
          }
        });
      } catch (error) {
        console.error('Error loading manual:', error);
        document.getElementById('content').innerHTML = \`
          <h1>Error Loading Manual</h1>
          <p>Unable to load the manual content. Please try refreshing the page or visit the <a href="https://github.com/danja/semem">GitHub repository</a> directly.</p>
          <details>
            <summary>Error Details</summary>
            <pre>\${error.message}</pre>
          </details>
        \`;
      }
    }
    
    document.addEventListener('DOMContentLoaded', loadManual);
  </script>
</body>
</html>`;

const manualDir = path.join(siteDir, 'manual');
if (fs.existsSync(manualDir)) {
  fs.writeFileSync(path.join(manualDir, 'index.html'), manualIndexHtml);
}

// Create HTML files for each manual page
if (fs.existsSync(manualDir)) {
  const manualFiles = fs.readdirSync(manualDir).filter(file =>
    file.endsWith('.md') && file !== 'index.md'
  );

  manualFiles.forEach(mdFile => {
    const baseName = path.basename(mdFile, '.md');
    const pageHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Semem Manual - ${baseName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      line-height: 1.6;
      color: #24292f;
      background-color: #ffffff;
    }
    .github-markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
    }
    .nav-bar {
      background: #f6f8fa;
      border-bottom: 1px solid #d1d9e0;
      padding: 1rem;
      margin-bottom: 2rem;
    }
    .nav-bar a {
      color: #0969da;
      text-decoration: none;
      margin-right: 1rem;
    }
    .nav-bar a:hover {
      text-decoration: underline;
    }
  </style>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <div class="nav-bar">
    <a href="../">← Documentation Home</a>
    <a href="index.html">Manual Index</a>
    <a href="../api/">API Reference</a>
    <a href="https://github.com/danja/semem">GitHub</a>
  </div>
  
  <div class="github-markdown-body" id="content">
    Loading...
  </div>
  
  <script>
    async function loadPage() {
      try {
        const response = await fetch('${baseName}.md');
        if (!response.ok) {
          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
        const markdown = await response.text();
        document.getElementById('content').innerHTML = marked.parse(markdown);
        
        // Update relative links
        const links = document.querySelectorAll('a[href$=".md"]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          if (href && !href.startsWith('http') && !href.startsWith('..')) {
            link.setAttribute('href', href.replace('.md', '.html'));
          }
        });
      } catch (error) {
        document.getElementById('content').innerHTML = '<h1>Error loading page</h1><p>Please try refreshing or visit the GitHub repository.</p>';
      }
    }
    document.addEventListener('DOMContentLoaded', loadPage);
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(manualDir, `${baseName}.html`), pageHtml);
  });
}

// Create .nojekyll file
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');

console.log('Documentation site structure created successfully!');
console.log('- Main index: _site/index.html');
console.log('- Manual: _site/manual/');
console.log('- API docs: _site/api/');
console.log('- .nojekyll created to disable Jekyll processing');