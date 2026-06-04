// Thin client for the backend REST API. In dev, Vite proxies /api → :3001.
import { supabase } from './supabase.js'

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

// Uploads a file straight to Supabase Storage using a server-minted signed URL,
// bypassing the serverless request-size limit. Returns { url, path } to store on
// the event (the bytes live in Storage; only the URL is kept in the row).
export async function uploadEventMedia(file) {
  if (!supabase) {
    throw new Error(
      'Media storage is not configured. Set VITE_SUPABASE_URL and ' +
        'VITE_SUPABASE_ANON_KEY, then redeploy.',
    )
  }
  const { token, path, publicUrl } = await eventMediaApi.getUploadUrl(file.name)
  const { error } = await supabase.storage
    .from('event-media')
    .uploadToSignedUrl(path, token, file, { contentType: file.type })
  if (error) throw error
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
