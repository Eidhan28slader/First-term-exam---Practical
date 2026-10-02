const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export async function request(path, options = {}) {
  const { token, body, ...fetchOptions } = options
  const headers = { ...(fetchOptions.headers || {}) }
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })
  if (response.status === 204) return null

  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.detail || 'No se pudo completar la solicitud')
  return result
}
