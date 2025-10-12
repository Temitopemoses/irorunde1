import React, { useState } from "react";

const LoginPage = () => {
  const [phone, setPhone] = useState("");
  const [surname, setSurname] = useState("");
  const [loading, setLoading] = useState(false);

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (!phone || !surname) return alert("Please fill in both phone number and surname");

  setLoading(true);
  try {
    const response = await fetch("http://127.0.0.1:8000/api/member-login/", {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-amber-600">
          Irorunde Member Login
        </h2>
        
        <p className="text-sm text-gray-600 text-center mb-6">
          Use your registered phone number and surname to login
        </p>

        <form onSubmit={handleSubmit}>
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white p-3 rounded-lg hover:bg-amber-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login as Member"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{" "}
            <a href="/join" className="text-amber-600 hover:text-amber-700 font-medium">
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;