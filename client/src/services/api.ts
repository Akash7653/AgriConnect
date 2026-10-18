import axios from 'axios';

const api = axios.create({
  // Use VITE_API_URL when deployed; fallback to relative /api for local dev
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token from localStorage automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agriconnect_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept 401 unauthenticated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token if invalid
      if (window.location.pathname.startsWith('/farmer') || window.location.pathname.startsWith('/admin')) {
        // Only clear if on protected route
        localStorage.removeItem('agriconnect_token');
        localStorage.removeItem('agriconnect_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
