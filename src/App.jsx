import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";
import LoginPage from "./Pages/LoginPage";
import MemberDashboard from "./Pages/MemberDashboard";
import GroupAdminDashboard from './components/GroupAdminDashboard';

// You will need to define your Django backend URL in your React app's environment variables
// For Vite, this would typically be VITE_DJANGO_ADMIN_URL in .env (e.g., VITE_DJANGO_ADMIN_URL=https://irorunde1-production.up.railway.app/admin/)
const DJANGO_ADMIN_BASE_URL = import.meta.env.VITE_DJANGO_ADMIN_URL || "https://irorunde1-production.up.railway.app/admin/";


function App() {
  return (
    <Router>
      <Routes> 
        {/* Client-side redirect for Django Admin */}
        <Route
          path="/irorunde-admin/*" // Use /* to catch all subpaths
          element={<Navigate to={DJANGO_ADMIN_BASE_URL} replace />}
        />
        {/* You may also want this for /system-admin/* if you want to keep that alias */}
        <Route
          path="/system-admin/*"
          element={<Navigate to={DJANGO_ADMIN_BASE_URL} replace />}
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
        <Route path="/Join" element={<Join />} />

        {/* Dashboard Routes (These should ideally be protected later) */}
        <Route path="/member-dashboard" element={<MemberDashboard />} />
        <Route path="/group-admin/dashboard" element={<GroupAdminDashboard />} />

        {/* Catch-all route for any undefined paths - your frontend's 404 */}
        <Route path="*" element={
          <>
            <Navbar />
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you are looking for does not exist.</p>
            </div>
          </>
        } />

      </Routes>
    </Router>
  );
}

export default App;