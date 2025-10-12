import axios from 'axios';
import { authHeaders } from '../services/auth';
import { useState } from 'react';

const CreateMemberForm = () => {
    const [form, setForm] = useState({
        name: '',
        surname: '',
        phone: '',
        address: '',
        group: '',
        password: ''
    });
    const [msg, setMsg] = useState('');

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const submit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(
                'http://127.0.0.1:8000/api/accounts/member/register/',
                form,
                { headers: authHeaders() }
            );
            setMsg('Member created');
        } catch (err) {
            console.error(err);
            setMsg(err.response?.data || 'Error');
        }
    };

    return (
        <div style={styles.container}>
            <h3>Create Member</h3>
            <form onSubmit={submit} style={styles.form}>
                <label>
                    First name
                    <input
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={handleChange}
                        style={styles.input}
                        required
                    />
                </label>
                <label>
                    Surname
                    <input
                        name="surname"
                        type="text"
                        value={form.surname}
                        onChange={handleChange}
                        style={styles.input}
                    />
                </label>
                <label>
                    Phone
                    <input
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        style={styles.input}
                        required
                    />
                </label>
                <label>
                    Password
                    <input
                        name="password"
                        type="password"
                        value={form.password}
                        onChange={handleChange}
                        style={styles.input}
                        required
                    />
                </label>
                <label>
                    Address
                    <input
                        name="address"
                        type="text"
                        value={form.address}
                        onChange={handleChange}
                        style={styles.input}
                    />
                </label>
                <label>
                    Group name
                    <input
                        name="group"
                        type="text"
                        value={form.group}
                        onChange={handleChange}
                        style={styles.input}
                    />
                </label>
                <button type="submit" style={styles.button}>
                    Create Member
                </button>
            </form>
            <p>{msg}</p>
        </div>
    );
};

const styles = {
    container: { background: '#fff', padding: 20, borderRadius: 10, maxWidth: 400, margin: '0 auto' },
    form: { display: 'flex', flexDirection: 'column', gap: '16px' },
    input: { padding: 10, border: '1px solid #ccc', borderRadius: 5, width: '100%' },
    button: { padding: 10, border: 'none', borderRadius: 5, background: '#28a745', color: '#fff', cursor: 'pointer' }
};

export default CreateMemberForm;