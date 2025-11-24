import axios from 'axios';

export const loginAdmin = async (identifier, password) => {
  const res = await axios.post('${API_URL}accounts/admin/login/', {
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
