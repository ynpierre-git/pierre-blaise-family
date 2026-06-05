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

export const eventMediaApi = {
  getUploadUrl: (name) => request('POST', '/api/event-media/upload-url', { name }),
  deleteObject: (path) => request('POST', '/api/event-media/delete', { path }),
}

export const broadcastApi = {
  send: (event, message, channels) =>
    request('POST', '/api/broadcast-event', { event, message, channels }),
}

export const healthApi = {
  get: () => request('GET', '/api/health'),
}

// Uploads a file straight to Supabase Storage using a server-minted signed URL,
// bypassing the serverless request-size limit. The signed token (embedded in the
// URL) authorizes the upload, so no Supabase key is needed in the browser.
// Returns { url, path } to store on the event — only the URL lives in the row.
export async function uploadEventMedia(file) {
  const { signedUrl, publicUrl, path } = await eventMediaApi.getUploadUrl(file.name)
  // Match Supabase Storage's signed-upload format: multipart with the file under
  // an empty field name plus a cacheControl field.
  const form = new FormData()
  form.append('cacheControl', '3600')
  form.append('', file, file.name)
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body: form,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Upload failed (${res.status}). ${detail}`.trim())
  }
  return { url: publicUrl, path }
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
