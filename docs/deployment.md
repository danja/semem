# Deployment Guide

## Prerequisites
```bash
# Node.js 18+ required
node --version

# Install dependencies
npm install semem
```

## Environment Setup
```bash
# .env file
OPENAI_API_KEY=your-key
STORAGE_API_KEY=your-storage-key
STORAGE_ENDPOINT=https://api.example.com
```

## Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "index.js"]
```

## Docker Compose
```yaml
version: '3.8'
services:
  semem:
    build: .
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
```

## PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start index.js --name semem

# Enable startup
pm2 startup
pm2 save
```
