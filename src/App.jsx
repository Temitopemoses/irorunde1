import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";
import LoginPage from "./Pages/LoginPage";
import MemberDashboard from "./Pages/MemberDashboard";
import AdminLogin from './components/admin/AdminLogin';
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';
import GroupAdminDashboard from './components/GroupAdminDashboard'; // This is correctly imported

function App() {
  return (
    <Router>
      <Routes>
        {/*
          IMPORTANT: Order of routes matters sometimes, especially with exact matches and catch-alls.
          More specific routes should come before less specific ones.
        */}

        {/* Public Routes with Navbar (if Home is the landing with navbar) */}
        {/* If your intention is for "/" to show Navbar and Home component */}
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
        <Route path="/Join" element={<Join />} /> {/* Moved up for clarity */}
        <Route path="/system-admin" element={<AdminLogin />} />

        {/* Dashboard Routes (These should ideally be protected later) */}
        <Route path="/member-dashboard" element={<MemberDashboard />} />
        <Route path="/superadmin-dashboard" element={<SuperAdminDashboard />} />
        <Route path="/group-admin/dashboard" element={<GroupAdminDashboard />} /> {/* This route is correctly defined! */}

        {/*
          REMOVE OR RETHINK THIS ROUTE:
          <Route path="/" element={<Navigate to="/login" />} />
          If you want '/' to redirect to '/login', then your Navbar/Home route above it will never be reached directly.
          If your intention is that unauthenticated users accessing ANY path should be redirected to login,
          that requires a different approach (e.g., a wrapper component for protected routes).
          For now, removing this conflicting one is the safest bet to make your other routes work.
        */}

        {/* Catch-all route for any undefined paths - your frontend's 404 */}
        <Route path="*" element={
          <>
            <Navbar /> {/* Optional: show navbar on 404 */}
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