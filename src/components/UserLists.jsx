import React, {useEffect, useState} from 'react';
import axios from 'axios';
import { authHeaders } from '../services/auth';

const UserList = ({ type }) => { // type = 'member' or 'admin'
  const [users, setUsers] = useState([]);
  useEffect(()=>{ fetchList(); },[type]);

  const fetchList = async () => {
    try {
      const url = `https://irorunde1-production.up.railway.app/accounts/${type === 'admin' ? 'admin/list/' : 'member/list/'}`;
      const res = await axios.get(url, { headers: authHeaders() });
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const deleteUser = async (id) => {
    if(!window.confirm('Delete?')) return;
    try {
      const url = `https://irorunde1-production.up.railway.app/accounts/${type === 'admin' ? 'admin/delete/' : 'member/delete/'}${id}/`;
      await axios.delete(url, { headers: authHeaders() });
      setUsers(users.filter(u => u.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div>
      <h3>{type==='admin'?'Admins':'Members'}</h3>
      <table>
        <thead><tr><th>ID</th><th>username/name</th><th>email/phone</th><th>Action</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username || `${u.name} ${u.surname}`}</td>
              <td>{u.email || u.phone}</td>
              <td><button onClick={()=>deleteUser(u.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
export default UserList;
