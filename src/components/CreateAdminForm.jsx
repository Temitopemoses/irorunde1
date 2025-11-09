import React, { useState } from 'react';
import axios from 'axios';

const CreateAdminForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('https://irorunde1-production.up.railway.app/accounts/admin/register/', formData);
      setMessage('✅ Admin created successfully!');
      console.log(response.data);
    } catch (error) {
      console.error('Error:', error);
      setMessage('❌ Failed to create admin. Check backend logs.');
    }
  };

  return (
    <div style={styles.container}>
      <h2>Create Admin</h2>
      {message && <p>{message}</p>}
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          name="username"
          placeholder="Username"
          onChange={handleChange}
          value={formData.username}
          style={styles.input}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          onChange={handleChange}
          value={formData.password}
          style={styles.input}
          required
        />
        <button type="submit" style={styles.button}>Create Admin</button>
      </form>
    </div>
  );
};

const styles = {
  container: { background: '#fff', padding: 20, borderRadius: 10 },
  form: { display: 'flex', flexDirection: 'column', gap: '10px' },
  input: { padding: 10, border: '1px solid #ccc', borderRadius: 5 },
  button: {
    background: 'gold',
    border: 'none',
    padding: 10,
    borderRadius: 5,
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default CreateAdminForm;
