import axios from 'axios';

const API_URL = '/api/admin';

const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 'Authorization': `Bearer ${token}` };
};

const adminService = {
    login: async (password) => {
        const response = await axios.post(`${API_URL}/login`, { password });
        if (response.data.token) {
            localStorage.setItem('admin_token', response.data.token);
        }
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin';
    },

    getOrders: async () => {
        const res = await axios.get(`${API_URL}/orders`, { headers: getAuthHeaders() });
        return res.data;
    },

    updateWeight: async (orderId, itemIndex, newWeightKg) => {
        return (await axios.post(`${API_URL}/update-weight`,
            { orderId, itemIndex, newWeightKg },
            { headers: getAuthHeaders() }
        )).data;
    },

    captureOrder: async (orderId) => {
        return (await axios.post(`${API_URL}/capture`, { orderId }, { headers: getAuthHeaders() })).data;
    },

    updateStatus: async (orderId, newStatus) => {
        return (await axios.post(`${API_URL}/update-status`, { orderId, newStatus }, { headers: getAuthHeaders() })).data;
    }
};

export default adminService;