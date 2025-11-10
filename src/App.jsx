import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";
import LoginPage from "./Pages/LoginPage";
import MemberDashboard from "./Pages/MemberDashboard";
// Removed: import AdminLogin from './components/admin/AdminLogin'; // This import is no longer needed
// Removed: import SuperAdminDashboard from './components/admin/SuperAdminDashboard'; // Assuming this also doesn't exist as a React component
import GroupAdminDashboard from './components/GroupAdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Home />
            </>
          }
        />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/Join" element={<Join />} />

        {/* Removed: <Route path="/system-admin" element={<AdminLogin />} /> */}

        <Route path="/member-dashboard" element={<MemberDashboard />} />
        {/* Removed: <Route path="/superadmin-dashboard" element={<SuperAdminDashboard />} /> */}
        <Route path="/group-admin/dashboard" element={<GroupAdminDashboard />} />

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