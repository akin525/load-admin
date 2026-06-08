import api from '../api';

type LoginCredentials = {
    email: string;
    password: string;
};

type LoginResponse = {
    success: boolean;
    token?: string;
    message?: string;
    data?: {
        token?: string;
        user?: unknown;
        admin?: unknown;
    };
};

type AdminPayload = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean | undefined>;

// Map exactly to the data expected by your Node.js backend
export const adminService = {
    // POST /admin-login
    login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        const response = await api.post('/admin-login', credentials);
        return response.data;
    },

    // POST /admin/admin
    createAdmin: async (adminData: AdminPayload) => {
        const response = await api.post('/admin/admin', adminData);
        return response.data;
    },

    // GET /admin/admins
    getAdmins: async () => {
        const response = await api.get('/admin/admins');
        return response.data;
    },

    // GET /admin/admins/:id
    getAdminById: async (id: string) => {
        const response = await api.get(`/admin/admins/${id}`);
        return response.data;
    },

    // PATCH /admin/admin/:id
    toggleAdminStatus: async (id: string) => {
        const response = await api.patch(`/admin/admin/${id}`);
        return response.data;
    },

    // GET /admin-dashboard/d/stats
    getDashboardStats: async (): Promise<unknown> => {
        const response = await api.get('/admin-dashboard/d/stats');
        return response.data;
    },

    // GET /admin-dashboard/d/loans-stats
    getLoansStats: async (): Promise<unknown> => {
        const response = await api.get('/admin-dashboard/d/loans-stats');
        return response.data;
    },

    // GET /admin-dashboard/d/recent-loans
    getRecentLoans: async (): Promise<unknown> => {
        const response = await api.get('/admin-dashboard/d/recent-loans');
        return response.data;
    },

    // GET /admin-dashboard/d/recent-bills
    getRecentBills: async (): Promise<unknown> => {
        const response = await api.get('/admin-dashboard/d/recent-bills');
        return response.data;
    },

    // GET /admin-dashboard/d/bills-stats
    getBillsStats: async (): Promise<unknown> => {
        const response = await api.get('/admin-dashboard/d/bills-stats');
        return response.data;
    },

    // GET /admin/bill/history
    getBillHistory: async (): Promise<unknown> => {
        const response = await api.get('/admin/bill/history');
        return response.data;
    },

    // GET /admin/bill/history/:serviceType
    getBillHistoryByServiceType: async (serviceType: string): Promise<unknown> => {
        const response = await api.get(`/admin/bill/history/${serviceType}`);
        return response.data;
    },

    // GET /admin/bill/details/:id
    getBillDetails: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/bill/details/${id}`);
        return response.data;
    },

    // PUT /admin/bill/fail_reverse/:id
    failReverseBill: async (id: string): Promise<unknown> => {
        const response = await api.put(`/admin/bill/fail_reverse/${id}`);
        return response.data;
    },

    // GET /admin/deposits
    getDeposits: async (): Promise<unknown> => {
        const response = await api.get('/admin/deposits');
        return response.data;
    },

    // GET /admin/roles
    getRoles: async (): Promise<unknown> => {
        const response = await api.get('/admin/roles');
        return response.data;
    },

    // POST /admin/role
    createRole: async (roleData: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/role', roleData);
        return response.data;
    },

    // PUT /admin/roles/:id
    updateRole: async (id: string, roleData: AdminPayload): Promise<unknown> => {
        const response = await api.put(`/admin/roles/${id}`, roleData);
        return response.data;
    },

    // GET /admin/permissions
    getPermissions: async (): Promise<unknown> => {
        const response = await api.get('/admin/permissions');
        return response.data;
    },

    // GET /admin/user/list
    getUsers: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/user/list', { params });
        return response.data;
    },

    // POST /admin/user/create
    createUser: async (userData: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/user/create', userData);
        return response.data;
    },

    // GET /admin/user/details/:id
    getUserDetails: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/user/details/${id}`);
        return response.data;
    },

    // GET /admin/users/:userId/virtual-accounts
    getUserVirtualAccounts: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/virtual-accounts`);
        return response.data;
    },

    // GET /admin/users/:userId/loans
    getUserLoans: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/loans`);
        return response.data;
    },

    // GET /admin/users/:userId/wallets
    getUserWallets: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/wallets`);
        return response.data;
    },

    // GET /admin/users/:userId/bills
    getUserBills: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/bills`);
        return response.data;
    },

    // GET /admin/users/:userId/bills/:serviceType
    getUserBillsByServiceType: async (userId: string, serviceType: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/bills/${serviceType}`);
        return response.data;
    },

    // GET /admin/users/:userId/kyc
    getUserKyc: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/kyc`);
        return response.data;
    },

    // POST /admin/users/:userId/broadcast
    broadcastToUser: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/broadcast`, payload);
        return response.data;
    },

    // GET /admin/users/:userId/dashboard
    getUserDashboard: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/dashboard`);
        return response.data;
    },

    // GET /admin/kycs
    getKycs: async (): Promise<unknown> => {
        const response = await api.get('/admin/kycs');
        return response.data;
    },

    // POST /admin/kycs
    createKyc: async (kycData: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/kycs', kycData);
        return response.data;
    },

    // GET /admin/kycs/:id
    getKycById: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/kycs/${id}`);
        return response.data;
    },

    // PATCH /admin/kycs/:id/approval
    approveKyc: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/kycs/${id}/approval`, payload);
        return response.data;
    },

    // GET /admin/loans/list
    getLoansList: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/loans/list', { params });
        return response.data;
    },

    // GET /admin/loans/packages
    getLoanPackages: async (): Promise<unknown> => {
        const response = await api.get('/admin/loans/packages');
        return response.data;
    },

    // GET /admin/loans/details/:id
    getLoanDetails: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/loans/details/${id}`);
        return response.data;
    },

    // GET /admin/loans/stats
    getAdminLoansStats: async (): Promise<unknown> => {
        const response = await api.get('/admin/loans/stats');
        return response.data;
    },

    // GET /admin/loans/recent
    getAdminRecentLoans: async (): Promise<unknown> => {
        const response = await api.get('/admin/loans/recent');
        return response.data;
    },

    // POST /admin/loans/:loanId/approve
    approveLoan: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/reject
    rejectLoan: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/reject`, payload ?? {});
        return response.data;
    },

    // GET /admin/account-tier
    getAccountTiers: async (): Promise<unknown> => {
        const response = await api.get('/admin/account-tier');
        return response.data;
    },

    // POST /admin/account-tier
    createAccountTier: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/account-tier', payload);
        return response.data;
    },

    // PATCH /admin/account-tier/:id
    updateAccountTier: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/account-tier/${id}`, payload);
        return response.data;
    },

    // GET /admin/complaints
    getComplaints: async (): Promise<unknown> => {
        const response = await api.get('/admin/complaints');
        return response.data;
    },

    // POST /admin/complaints/:id/reply
    replyComplaint: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/complaints/${id}/reply`, payload);
        return response.data;
    },

    // PATCH /admin/complaints/:id/status
    updateComplaintStatus: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/complaints/${id}/status`, payload);
        return response.data;
    },

    // GET /admin/complaint-category
    getComplaintCategories: async (): Promise<unknown> => {
        const response = await api.get('/admin/complaint-category');
        return response.data;
    },

    // POST /admin/complaint-category
    createComplaintCategory: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/complaint-category', payload);
        return response.data;
    },

    // GET /admin/contact-us
    getContactUs: async (): Promise<unknown> => {
        const response = await api.get('/admin/contact-us');
        return response.data;
    },

    // POST /admin/contact-us
    createContactUs: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/contact-us', payload);
        return response.data;
    },

    // PATCH /admin/contact-us/:id
    updateContactUs: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/contact-us/${id}`, payload);
        return response.data;
    },

    // GET /admin/faqs
    getFaqs: async (): Promise<unknown> => {
        const response = await api.get('/admin/faqs');
        return response.data;
    },

    // POST /admin/faqs
    createFaq: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/faqs', payload);
        return response.data;
    },

    // PATCH /admin/faqs/:id
    updateFaq: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/faqs/${id}`, payload);
        return response.data;
    },

    // GET /admin/livechat
    getLiveChat: async (): Promise<unknown> => {
        const response = await api.get('/admin/livechat');
        return response.data;
    },

    // GET /admin/loan-types
    getLoanTypes: async (): Promise<unknown> => {
        const response = await api.get('/admin/loan-types');
        return response.data;
    },

    // POST /admin/loan-types
    createLoanType: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/loan-types', payload);
        return response.data;
    },

    // PATCH /admin/loan-types/:id
    updateLoanType: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/loan-types/${id}`, payload);
        return response.data;
    },

    // GET /admin/app-loans
    getAppLoans: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/app-loans', { params });
        return response.data;
    },

    // GET /admin/app-loans/:id
    getAppLoanById: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/app-loans/${id}`);
        return response.data;
    },

    // POST /admin/app-loans/:id/score
    scoreAppLoan: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/score`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/approve
    approveAppLoan: async (id: string): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/approve`, {});
        return response.data;
    },

    // POST /admin/app-loans/:id/reject
    rejectAppLoan: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/reject`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/top-up/approve
    approveAppLoanTopUp: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/top-up/approve`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/top-up/reject
    rejectAppLoanTopUp: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/top-up/reject`, payload);
        return response.data;
    }
};
