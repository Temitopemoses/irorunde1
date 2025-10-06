import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Mock user data for demonstration
  const mockUsers = {
    'superadmin@example.com': {
      id: 1,
      name: 'Super Admin',
      email: 'superadmin@example.com',
      role: 'superadmin'
    },
    'admin@example.com': {
      id: 2,
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin'
    },
    'member@example.com': {
      id: 3,
      name: 'Member User',
      email: 'member@example.com',
      role: 'member'
    }
  }

  useEffect(() => {
    // Check for stored authentication on app load
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    // Mock authentication - in real app, this would be an API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (mockUsers[email] && password === 'password') {
          const userData = mockUsers[email]
          setUser(userData)
          setIsAuthenticated(true)
          localStorage.setItem('user', JSON.stringify(userData))
          resolve(userData)
        } else {
          reject(new Error('Invalid credentials'))
        }
      }, 1000)
    })
  }

  const register = async (name, email, password, role) => {
    // Mock registration - in real app, this would be an API call
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!mockUsers[email]) {
          const newUser = {
            id: Date.now(),
            name,
            email,
            role
          }
          // In a real app, you would send this to your backend
          resolve(newUser)
        } else {
          reject(new Error('User already exists'))
        }
      }, 1000)
    })
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('user')
  }

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}