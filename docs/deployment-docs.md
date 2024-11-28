# Deployment Guide

## Prerequisites
- Node.js 18+
- NPM or Yarn
- OpenAI API key (optional)
- Ollama installation (optional)

## Installation
```bash
npm install semem
```

## Environment Setup
```bash
OPENAI_API_KEY=your-key
STORAGE_API_KEY=your-storage-key
STORAGE_ENDPOINT=https://api.example.com
```

## Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]
```

## Security Considerations
- API key management
- Rate limiting
- Error handling
- Logging configuration
