// Mock implementation of status-resource-http.js
export const registerStatusResourcesHttp = vi.fn().mockResolvedValue({
  // Mock implementation of the HTTP status resources
  start: vi.fn().mockResolvedValue({ success: true }),
  stop: vi.fn().mockResolvedValue({ success: true }),
  getStatus: vi.fn().mockResolvedValue({ status: 'ok' })
});
