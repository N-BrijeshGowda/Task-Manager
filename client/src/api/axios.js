import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is rejected, drop it and go back to the login page.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthCall = err.config?.url?.startsWith('/auth/login') || err.config?.url?.startsWith('/auth/register');
    if (err.response?.status === 401 && !isAuthCall) {
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
