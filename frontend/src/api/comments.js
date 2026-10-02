import { request } from './client.js'

export const commentsApi = {
  list: (videoId) => request(`/videos/${videoId}/comments`),
  create: (videoId, content, token) => request(`/videos/${videoId}/comments`, {
    method: 'POST',
    token,
    body: { content },
  }),
}
