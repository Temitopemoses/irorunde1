// API utility functions
const API_BASE_URL = 'http://localhost:3001/api'

export const api = {
  // Auth endpoints
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse(response)
  },

  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    })
    return handleResponse(response)
  },

  // User management endpoints
  getUsers: async (token) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    return handleResponse(response)
  },

  updateUser: async (userId, userData, token) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(userData),
    })
    return handleResponse(response)
  },

  deleteUser: async (userId, token) => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    return handleResponse(response)
  },
}

// Handle API response
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || 'Network response was not ok')
  }
  return response.json()
}

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}