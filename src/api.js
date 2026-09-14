const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("northgate_token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed.");
  return body;
}

export const api = {
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  profile: (payload) => request("/users/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  health: () => request("/health"),
  events: () => request("/events?limit=20"),
  list: (resource) => request(`/${resource}`),
  create: (resource, payload) => request(`/${resource}`, { method: "POST", body: JSON.stringify(payload) }),
  update: (resource, id, payload) => request(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (resource, id) => request(`/${resource}/${id}`, { method: "DELETE" }),
  decide: (plate) => request("/access/decide", { method: "POST", body: JSON.stringify({ plate }) })
};
