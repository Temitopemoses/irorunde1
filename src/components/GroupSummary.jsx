import React, {useEffect,useState} from 'react';
import axios from 'axios';
import { authHeaders } from '../services/auth';

const GroupSummary = () => {
  const [data, setData] = useState(null);
  useEffect(()=>{ fetchData(); },[]);
  const fetchData = async ()=> {
    try {
      const res = await axios.get('https://irorunde1-production.up.railway.app/api/apimembers/group-summary/', { headers: authHeaders() });
      setData(res.data);
    } catch(err){ console.error(err); }
  };

  if(!data) return <div>Loading...</div>;
  return (
    <div>
      <h3>Group totals for {data.month}</h3>
      <ul>
        {data.group_totals.map((g,i)=>(
          <li key={i}>{g.group_name || 'No group'} — ₦{Number(g.total||0).toLocaleString()}</li>
        ))}
      </ul>

      <h4>Member totals</h4>
      <ul>
        {data.member_totals.map((m,i)=>(
          <li key={i}>{m.name} {m.surname} ({m.phone}) — ₦{Number(m.total||0).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
};
export default GroupSummary;
