import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./Pages/home";
import Join from "./Pages/Join";    
import LoginPage from "./Pages/LoginPage";
import MemberDashboard from "./Pages/MemberDashboard";
import AdminLogin from './components/admin/AdminLogin';
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';


function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page with navbar */}
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <Home />
            </>
          }
        />

        {/* Join page without navbar */}
        <Route path="/Join" element={<Join />} />
        <Route path="/login" element={<LoginPage />} />
          <Route path="/member-dashboard" element={<MemberDashboard />} />
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/system-admin" element={<AdminLogin />} />
          <Route path="/superadmin-dashboard" element={<SuperAdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
