import React, { useState } from "react";
import { getCSRFToken } from "../utils/csrf";

// ADD THIS LINE 👇
const API_URL = "https://irorunde1-production.up.railway.app/api";

const LoginPage = () => {
  const [phone, setPhone] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState("member");
  const [loading, setLoading] = useState(false);

  const handleMemberLogin = async (e) => {
    e.preventDefault();
    if (!phone || !surname) return alert("Please fill in both phone number and surname");

    setLoading(true);
    try {
      // CHANGED: Use API_URL variable instead of hardcoded URL
      const response = await fetch(`${API_URL}/auth/member-login/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          phone: phone.trim(), 
          surname: surname.trim() 
        }),
      });

      const data = await response.json();
      console.log("Member login response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Login failed");
      }

      // Check if member is approved
      if (data.user && data.user.status !== 'approved') {
        throw new Error("Your account is pending approval. Please wait for admin confirmation.");
      }

      // Handle both response formats
      const accessToken = data.access || data.token;
      const refreshToken = data.refresh;
      const userData = data.user || data;

      if (!accessToken) {
        throw new Error("No access token received from server");
      }

      // Save tokens and user data
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken || "");
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("userRole", userData.role || 'member');

      console.log("Login successful, stored data:", {
        accessToken: localStorage.getItem("accessToken"),
        userData: localStorage.getItem("userData"),
        userRole: localStorage.getItem("userRole")
      });

      alert(`Welcome back, ${userData.first_name} ${userData.last_name}!`);
      
      // REDIRECT TO MEMBER DASHBOARD
      window.location.href = "/member-dashboard";

    } catch (err) {
      console.error("Member login error:", err);
      alert(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGroupAdminLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return alert("Please fill in both username and password");

    setLoading(true);
    try {
      // Get CSRF token first
      const csrfResponse = await fetch(`${API_URL}/auth/csrf/`, { 
        credentials: "include" 
      });
      console.log("CSRF response:", csrfResponse);
      
      // CHANGED: Use API_URL variable
      const response = await fetch(`${API_URL}/auth/group-admin-login/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "include",
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();
      console.log("Group admin login response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Login failed");
      }

      // Check if user is actually a group admin
      const userRole = data.user?.role || data.role;
      if (userRole !== 'group_admin') {
        throw new Error("Access denied. Group admin access only.");
      }

      // Handle both response formats
      const accessToken = data.access || data.token;
      const refreshToken = data.refresh;
      const userData = data.user || data;

      if (!accessToken) {
        throw new Error("No access token received from server");
      }

      // Save tokens and user data
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken || "");
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("userRole", userData.role || 'group_admin');

      console.log("Group admin login successful, stored data:", {
        accessToken: localStorage.getItem("accessToken"),
        userData: localStorage.getItem("userData"),
        userRole: localStorage.getItem("userRole")
      });

      alert(`Welcome back, ${userData.first_name} ${userData.last_name}!`);
      
      // REDIRECT TO GROUP ADMIN DASHBOARD
      console.log("Redirecting to group admin dashboard...");
      window.location.href = "/group-admin/dashboard";

    } catch (err) {
      console.error("Group admin login error:", err);
      alert(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuperAdminLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return alert("Please fill in both username and password");

    setLoading(true);
    try {
      // Get CSRF token first
      await fetch(`${API_URL}/auth/csrf/`, { 
        credentials: "include" 
      });
      
      // CHANGED: Use API_URL variable
      const response = await fetch(`${API_URL}/auth/superadmin-login/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "include",
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();
      console.log("Super admin login response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Login failed");
      }

      // Check if user is actually a super admin
      const userRole = data.user?.role || data.role;
      if (userRole !== 'superadmin') {
        throw new Error("Access denied. Super admin access only.");
      }

      // Handle both response formats
      const accessToken = data.access || data.token;
      const refreshToken = data.refresh;
      const userData = data.user || data;

      if (!accessToken) {
        throw new Error("No access token received from server");
      }

      // Save tokens and user data
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken || "");
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("userRole", userData.role || 'superadmin');

      console.log("Super admin login successful, stored data:", {
        accessToken: localStorage.getItem("accessToken"),
        userData: localStorage.getItem("userData"),
        userRole: localStorage.getItem("userRole")
      });

      alert(`Welcome back, ${userData.first_name} ${userData.last_name}!`);
      
      // REDIRECT TO SUPER ADMIN DASHBOARD
      console.log("Redirecting to super admin dashboard...");
      window.location.href = "/super-admin/dashboard";

    } catch (err) {
      console.error("Super admin login error:", err);
      alert(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = (e) => {
    if (loginType === "member") {
      handleMemberLogin(e);
    } else if (loginType === "group_admin") {
      handleGroupAdminLogin(e);
    } else {
      handleSuperAdminLogin(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-amber-600">
          Irorunde Cooperative Login
        </h2>
        
        {/* Login Type Toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              loginType === "member" 
                ? "bg-amber-600 text-white shadow" 
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setLoginType("member")}
          >
            Member Login
          </button>
          <button
            type="button"
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              loginType === "group_admin" 
                ? "bg-amber-600 text-white shadow" 
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setLoginType("group_admin")}
          >
            Group Admin
          </button>
         </div>

        <p className="text-sm text-gray-600 text-center mb-6">
          {loginType === "member" 
            ? "Use your registered phone number and surname to login" 
            : loginType === "group_admin"
            ? "Use your username and password to access group admin dashboard"
            : "Use your username and password to access super admin dashboard"
          }
        </p>

        <form onSubmit={handleSubmit}>
          {loginType === "member" ? (
            <>
              {/* Member Login Form */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="Enter your registered phone number"
                  className="w-full p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Surname *
                </label>
                <input
                  type="text"
                  placeholder="Enter your surname"
                  className="w-full p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required
                />
              </div>
            </>
          ) : (
            <>
              {/* Admin Login Form (Group Admin & Super Admin) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  className="w-full p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="w-full p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : 
              loginType === "member" ? "Login as Member" : 
              loginType === "group_admin" ? "Login as Group Admin" : 
              "Login as Super Admin"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {loginType === "member" ? (
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <a href="/join" className="text-amber-600 hover:text-amber-700 font-medium">
                Register here
              </a>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Need member access?{" "}
              <button 
                onClick={() => setLoginType("member")}
                className="text-amber-600 hover:text-amber-700 font-medium"
              >
                Login as member
              </button>
            </p>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-center space-x-4">
            <a href="/" className="text-sm text-amber-600 hover:text-amber-700">
              Home
            </a>
            <a href="/join" className="text-sm text-amber-600 hover:text-amber-700">
              Join Us
            </a>
            <a href="/" className="text-sm text-amber-600 hover:text-amber-700">
              About
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;