import { request } from './client.js'

export const authApi = {
  register: (user) => request('/users', { method: 'POST', body: user }),
  login: (credentials) => request('/login', { method: 'POST', body: credentials }),
  getUser: (userId) => request(`/users/${userId}`),
}
