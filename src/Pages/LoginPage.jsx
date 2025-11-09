import React, { useState } from "react";
import { getCSRFToken } from "../utils/csrf"; // Utility function to get CSRF token from cookies

const LoginPage = () => {
  const [phone, setPhone] = useState("");
  const [surname, setSurname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState("member"); // "member" or "group_admin"
  const [loading, setLoading] = useState(false);

  const handleMemberLogin = async (e) => {
    e.preventDefault();
    if (!phone || !surname) return alert("Please fill in both phone number and surname");

    setLoading(true);
    try {
      const response = await fetch("https://irorunde1-production.up.railway.app/member-login/", {
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

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Save tokens and user data
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("userData", JSON.stringify(data));

      alert(`Welcome back, ${data.first_name} ${data.last_name}!`);
      
      // REDIRECT TO MEMBER DASHBOARD
      window.location.href = "/member-dashboard";

    } catch (err) {
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
      await fetch("https://irorunde1-production.up.railway.app/csrf/", { credentials: "include" });
      const response = await fetch("https://irorunde1-production.up.railway.app/accounts/login/", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(), // make sure you include CSRF token

        },
        credentials: "include", // include cookies in the request
        body: JSON.stringify({ 
          username: username.trim(), 
          password: password.trim() 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Check if user is actually a group admin
      if (data.user.role !== 'group_admin') {
        throw new Error("Access denied. Group admin access only.");
      }

      // Save tokens and user data
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      alert(`Welcome back, ${data.user.first_name} ${data.user.last_name}!`);
      
      // REDIRECT TO GROUP ADMIN DASHBOARD
      window.location.href = "/group-admin/dashboard";

    } catch (err) {
      alert(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    if (loginType === "member") {
      handleMemberLogin(e);
    } else {
      handleGroupAdminLogin(e);
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
            : "Use your username and password to access group admin dashboard"
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
              {/* Group Admin Login Form */}
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
            {loading ? "Logging in..." : `Login as ${loginType === "member" ? "Member" : "Group Admin"}`}
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