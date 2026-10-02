import { request } from './client.js'

export const videosApi = {
  list: () => request('/videos'),
  get: (videoId) => request(`/videos/${videoId}`),
  recommendations: (videoId) => request(`/videos/${videoId}/recommendations`),
  listByUser: (userId) => request(`/users/${userId}/videos`),
  requestUploadUrl: (payload, token) => request('/videos/upload-url', {
    method: 'POST',
    token,
    body: payload,
  }),
  create: (video, token) => request('/videos', { method: 'POST', token, body: video }),
  update: (videoId, updates, token) => request(`/videos/${videoId}`, {
    method: 'PUT',
    token,
    body: updates,
  }),
  delete: (videoId, token) => request(`/videos/${videoId}`, { method: 'DELETE', token }),
}
