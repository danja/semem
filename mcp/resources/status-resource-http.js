// Mock implementation of status-resource-http.js
export const registerStatusResourcesHttp = () => ({
  start: async () => ({ success: true }),
  stop: async () => ({ success: true }),
  getStatus: async () => ({ status: 'ok' })
});
