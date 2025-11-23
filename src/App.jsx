import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";
import LoginPage from "./Pages/LoginPage";
import MemberDashboard from "./Pages/MemberDashboard";
import GroupAdminDashboard from './components/GroupAdminDashboard';
import AdminMemberDashboard from './components/AdminMemberDashboard';
// You will need to define your Django backend URL in your React app's environment variables
// For Vite, this would typically be VITE_DJANGO_ADMIN_URL in .env (e.g., VITE_DJANGO_ADMIN_URL=https://irorunde1-production.up.railway.app/admin/)
const REACT_APP_API_BASE = import.meta.env.REACT_APP_API_BASE || "http://localhost:8000/api";

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole = null }) => {
  const token = localStorage.getItem('accessToken');
  const userData = localStorage.getItem('userData');
  
  if (!token || !userData) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole) {
    try {
      const user = JSON.parse(userData);
      if (user.role !== requiredRole) {
        alert(`Access denied. ${requiredRole} access required.`);
        return <Navigate to="/login" replace />;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes> 
        {/* Client-side redirect for Django Admin */}
        <Route
          path="/irorunde-admin/*"
          element={<Navigate to={REACT_APP_API_BASE} replace />}
        />
        <Route
          path="/system-admin/*"
          element={<Navigate to={REACT_APP_API_BASE} replace />}
        />

        {/* Public Routes with Navbar */}
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Home />
            </>
          }
        />

        {/* Authentication related routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/join" element={<Join />} />

        {/* Protected Dashboard Routes */}
        <Route 
          path="/member-dashboard" 
          element={
            <ProtectedRoute requiredRole="member">
              <MemberDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/group-admin/dashboard" 
          element={
            <ProtectedRoute requiredRole="group_admin">
              <GroupAdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        
        <Route 
          path="/admin/members/:memberId/dashboard/" 
          element={
            <ProtectedRoute requiredRole="group_admin">
              <AdminMemberDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all route - redirect to home instead of login */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;