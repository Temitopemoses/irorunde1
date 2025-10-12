import React from 'react';
const Sidebar = ({ setView }) => (
  <aside style={{ width:230, position:'fixed', height:'100vh', padding:20, background:'#111', color:'#fff' }}>
    <h2>SuperAdmin</h2>
    <ul style={{ listStyle:'none', padding:0 }}>
      <li onClick={() => setView('overview')} style={{cursor:'pointer', margin:'12px 0'}}>Overview</li>
      <li onClick={() => setView('createAdmin')} style={{cursor:'pointer', margin:'12px 0'}}>Create Admin</li>
      <li onClick={() => setView('createMember')} style={{cursor:'pointer', margin:'12px 0'}}>Create Member</li>
      <li onClick={() => setView('membersList')} style={{cursor:'pointer', margin:'12px 0'}}>View Members</li>
      <li onClick={() => setView('adminsList')} style={{cursor:'pointer', margin:'12px 0'}}>Manage Admins</li>
      <li onClick={() => setView('groups')} style={{cursor:'pointer', margin:'12px 0'}}>Groups Summary</li>
    </ul>
  </aside>
);
export default Sidebar;
