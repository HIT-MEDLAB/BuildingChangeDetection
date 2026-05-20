import axios from 'axios';

// Create a pre-configured Axios instance that points at our backend.
// All API calls should use this instance instead of importing axios directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// TODO: Add a request interceptor to attach the JWT token
// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token'); // or however you store it
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// TODO: Add a response interceptor to handle 401 errors (redirect to login)

export default api;
