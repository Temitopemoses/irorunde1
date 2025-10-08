import React, { useState } from "react";

const LoginPage = () => {
  const [role, setRole] = useState(""); // "member" or "admin"
  const [identifier, setIdentifier] = useState(""); // phone or username
  const [password, setPassword] = useState("");

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!role) return alert("Select role");
  if (!identifier || !password) return alert("Fill fields");

  const endpoint = role === "member" ? "/api/member/login/" : "/api/admin/login/";
  try {
    const res = await fetch("http://127.0.0.1:8000" + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return alert(data.detail || data.message || "Login failed");
    }

    // Save access token in localStorage for protected calls
    if (data.tokens && data.tokens.access) {
      localStorage.setItem("accessToken", data.tokens.access);
      if (data.tokens.refresh) {
        localStorage.setItem("refreshToken", data.tokens.refresh);
      }
    }

    alert("Login successful");
    if (role === "member") window.location.href = "/member-dashboard";
    else window.location.href = "/admin-dashboard";
  } catch (err) {
    console.error(err);
    alert("Network error");
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-amber-600">
          Irorunde Cooperative Login
        </h2>

        {/* Select role */}
        <div className="flex justify-center space-x-3 mb-6">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg border transition ${
              role === "member"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-amber-400"
            }`}
            onClick={() => setRole("member")}
          >
            Member
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg border transition ${
              role === "admin"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-amber-400"
            }`}
            onClick={() => setRole("admin")}
          >
            Admin
          </button>
        </div>

        {/* Login form */}
        {role && (
          <form onSubmit={handleSubmit}>
            <input
              type={role === "member" ? "tel" : "text"}
              placeholder={
                role === "member"
                  ? "Registered Phone Number"
                  : "Admin Username"
              }
              className="w-full mb-4 p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full mb-4 p-3 border rounded-lg focus:ring focus:ring-amber-200 focus:border-amber-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 transition font-semibold"
            >
              Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
