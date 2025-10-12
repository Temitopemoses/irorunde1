import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

const SuperAdminDashboard = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/members/list/")
      .then((res) => res.json())
      .then((data) => {
        setMembers(data);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  const groupTotals = members.reduce((acc, member) => {
    if (!acc[member.group]) acc[member.group] = 0;
    acc[member.group] += 20300; // assume each paid ₦20,300
    return acc;
  }, {});

  const totalMoney = members.length * 20300;

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold text-amber-700 mb-6">
          Superadmin Dashboard
        </h1>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl shadow">
                <h3 className="text-sm text-gray-500">Total Members</h3>
                <p className="text-xl font-bold">{members.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow">
                <h3 className="text-sm text-gray-500">Total Groups</h3>
                <p className="text-xl font-bold">{Object.keys(groupTotals).length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow">
                <h3 className="text-sm text-gray-500">Total Money</h3>
                <p className="text-xl font-bold">₦{totalMoney.toLocaleString()}</p>
              </div>
            </div>

            {/* Group Totals */}
            <div className="bg-white rounded-xl shadow p-4 mb-6">
              <h2 className="text-lg font-semibold text-amber-700 mb-3">
                Group Totals
              </h2>
              <ul className="divide-y">
                {Object.entries(groupTotals).map(([group, total]) => (
                  <li key={group} className="py-2 flex justify-between">
                    <span>{group}</span>
                    <span className="font-semibold">₦{total.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">
              <h2 className="text-lg font-semibold text-amber-700 mb-3">
                Members List
              </h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-amber-100 text-gray-700">
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Group</th>
                    <th className="p-2 border">Phone</th>
                    <th className="p-2 border">Address</th>
                    <th className="p-2 border">Total (₦)</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{m.name} {m.surname}</td>
                      <td className="p-2">{m.group}</td>
                      <td className="p-2">{m.phone}</td>
                      <td className="p-2">{m.address}</td>
                      <td className="p-2">20,300</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
