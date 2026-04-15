import axios from 'axios';

// Prefer explicit VITE_API_URL when the API is on another origin (e.g. staging).
// Otherwise use same-origin requests: Vite proxies /api in dev; in production nginx serves /api.
// Never default production to http://localhost:5001 — that targets the visitor's machine, not your server.
const API_URL = import.meta.env.VITE_API_URL ?? '';

axios.defaults.baseURL = API_URL;
axios.defaults.headers.common['Content-Type'] = 'application/json';

export default axios;
