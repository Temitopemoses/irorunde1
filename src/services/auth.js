import axios from 'axios';

export const loginAdmin = async (identifier, password) => {
  const res = await axios.post('http://127.0.0.1:8000/api/accounts/admin/login/', {
    identifier, password
  });
  // store tokens
  const access = res.data.tokens.access;
  localStorage.setItem('access_token', access);
  return res.data;
};

export const authHeaders = () => {
  const token = localStorage.getItem('access_token');
  return { Authorization: token ? `Bearer ${token}` : '' };
};
