// Thin client for the backend REST API. In dev, Vite proxies /api → :3001.
const API = import.meta.env.VITE_API_URL || ''

async function request(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

export const membersApi = {
  list: () => request('GET', '/api/members'),
  create: (m) => request('POST', '/api/members', m),
  update: (id, m) => request('PUT', `/api/members/${id}`, m),
  remove: (id) => request('DELETE', `/api/members/${id}`),
}

export const eventsApi = {
  list: () => request('GET', '/api/events'),
  create: (e) => request('POST', '/api/events', e),
  update: (id, e) => request('PUT', `/api/events/${id}`, e),
  remove: (id) => request('DELETE', `/api/events/${id}`),
}

export const contentApi = {
  get: (key) => request('GET', `/api/content/${key}`),
  save: (key, value) => request('PUT', `/api/content/${key}`, value),
}

// Reads a File into a base64 data URL so it can be stored in the database.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
