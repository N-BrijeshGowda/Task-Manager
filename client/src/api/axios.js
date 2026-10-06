import axios from 'axios';

// Local dev: API on port 5000. Production: the API is served from the same address as the site.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api'),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is rejected (expired, or the account was disabled), go back to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/register');
    const status = err.response?.status;
    const disabled = status === 403 && err.response?.data?.code === 'disabled';
    if ((status === 401 || disabled) && !isAuthCall) {
      localStorage.removeItem('token');
      window.location.hash = '#/login';
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err.response?.data?.message || (err.request ? 'Cannot reach the server. Is it running?' : 'Something went wrong');

export default api;
