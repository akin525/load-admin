import api from '../api';

type LoginCredentials = {
    email: string;
    password: string;
};

type LoginResponse = {
    success: boolean;
    requiresTwoFactor?: boolean;
    requiresOtp?: boolean;
    token?: string;
    message?: string;
    data?: {
        token?: string;
        user?: unknown;
        admin?: unknown;
        challengeId?: string;
        channel?: string;
        email?: string;
        expiresAt?: string;
    };
};

type VerifyTwoFactorPayload = {
    challengeId: string;
    code: string;
};

type ChangePasswordPayload = {
    oldPassword: string;
    newPassword: string;
};

type ForgotPasswordRequestPayload = {
    email: string;
};

type ResetPasswordWithCodePayload = {
    email: string;
    code: string;
    password: string;
};

type AdminPayload = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean | undefined>;

const getHeaderValue = (headers: unknown, key: string) => {
    if (!headers || typeof headers !== 'object') {
        return '';
    }

    if ('get' in headers && typeof (headers as { get?: unknown }).get === 'function') {
        const value = (headers as { get: (name: string) => unknown }).get(key);
        return typeof value === 'string' ? value : '';
    }

    const record = headers as Record<string, unknown>;
    const direct = record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];
    return typeof direct === 'string' ? direct : '';
};

const parseFilenameFromDisposition = (contentDisposition: string) => {
    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
        return decodeURIComponent(utfMatch[1]);
    }

    const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (quotedMatch?.[1]) {
        return quotedMatch[1];
    }

    const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
    return plainMatch?.[1]?.trim() ?? '';
};

const inferExtensionFromType = (contentType: string, fallback = 'csv') => {
    const normalized = contentType.toLowerCase();

    if (normalized.includes('pdf')) {
        return 'pdf';
    }

    if (normalized.includes('csv') || normalized.includes('excel') || normalized.includes('spreadsheet')) {
        return 'csv';
    }

    if (normalized.includes('json')) {
        return 'json';
    }

    return fallback;
};

// Map exactly to the data expected by your Node.js backend
export const adminService = {
    // POST /admin-login
    login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        const response = await api.post('/admin-login', credentials);
        return response.data;
    },

    // POST /admin-login/verify-2fa
    verifyAdminTwoFactor: async (payload: VerifyTwoFactorPayload): Promise<LoginResponse> => {
        const response = await api.post('/admin-login/verify-2fa', payload);
        return response.data;
    },

    // PUT /admin/change-password
    changePassword: async (payload: ChangePasswordPayload): Promise<unknown> => {
        const response = await api.put('/admin/change-password', payload);
        return response.data;
    },

    // POST /admin/forgot-password
    requestAdminPasswordResetCode: async (payload: ForgotPasswordRequestPayload): Promise<unknown> => {
        const response = await api.post('/admin/forgot-password', payload);
        return response.data;
    },

    // PUT /admin/forgot-password
    resetAdminPasswordWithCode: async (payload: ResetPasswordWithCodePayload): Promise<unknown> => {
        const response = await api.put('/admin/forgot-password', payload);
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

    // PATCH /admin/admins/:id
    updateAdmin: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/admins/${id}`, payload);
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

    // POST /admin/bills/:id/apply-vtpass-webhook
    applyVtpassWebhookToBill: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/bills/${id}/apply-vtpass-webhook`, payload);
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

    // GET /admin/roles/:id/permissions
    getRolePermissions: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/roles/${id}/permissions`);
        return response.data;
    },

    // POST /admin/role
    createRole: async (roleData: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/role', roleData);
        return response.data;
    },

    // PATCH /roles/:id
    updateRole: async (id: string, roleData: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/roles/${id}`, roleData);
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

    // GET /admin/users/:userId/xpress-wallet/balance
    getUserXpressWalletBalance: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/xpress-wallet/balance`);
        return response.data;
    },

    // PUT /admin/users/:userId/xpress-wallet/customer
    updateUserXpressWalletCustomer: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.put(`/admin/users/${userId}/xpress-wallet/customer`, payload);
        return response.data;
    },

    // GET /admin/xpress-wallet/merchant
    getXpressMerchantWallet: async (): Promise<unknown> => {
        const response = await api.get('/admin/xpress-wallet/merchant');
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

    // GET /admin/users/:userId/referral
    getUserReferral: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/referral`);
        return response.data;
    },

    // POST /admin/users/:userId/notifications/send
    sendUserNotification: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/notifications/send`, payload);
        return response.data;
    },

    // POST /admin/users/:userId/revoke-sessions
    revokeUserSessions: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/revoke-sessions`, payload);
        return response.data;
    },

    // POST /admin/notifications/broadcast
    broadcastNotification: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/notifications/broadcast', payload);
        return response.data;
    },

    // GET /admin/users/:userId/dashboard
    getUserDashboard: async (userId: string): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/dashboard`);
        return response.data;
    },

    // GET /admin/users/:userId/transactions
    getUserTransactions: async (userId: string, params?: QueryParams): Promise<unknown> => {
        const response = await api.get(`/admin/users/${userId}/transactions`, { params });
        return response.data;
    },

    // GET /admin/users/:userId/wallets/statement/download
    downloadUserWalletStatement: async (
        userId: string,
        params?: QueryParams,
    ): Promise<{ blob: Blob; filename: string; contentType: string }> => {
        const response = await api.get(`/admin/users/${userId}/wallets/statement/download`, {
            params,
            responseType: 'blob',
        });
        const contentDisposition = getHeaderValue(response.headers, 'content-disposition');
        const contentType = getHeaderValue(response.headers, 'content-type') || 'application/octet-stream';
        const extension = String(params?.format ?? 'pdf').toLowerCase();
        const filename = parseFilenameFromDisposition(contentDisposition) || `wallet-statement-${userId}.${extension}`;

        return {
            blob: response.data as Blob,
            filename,
            contentType,
        };
    },

    // POST /admin/users/:userId/wallets/statement/email
    emailUserWalletStatement: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/wallets/statement/email`, payload);
        return response.data;
    },

    // GET /admin/action-requests
    getActionRequests: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/action-requests', { params });
        return response.data;
    },

    // GET /admin/action-requests/:id
    getActionRequestById: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/action-requests/${id}`);
        return response.data;
    },

    // POST /admin/action-requests/:id/reject
    rejectActionRequest: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/action-requests/${id}/reject`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/reset-password
    resetUserPassword: async (userId: string): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/reset-password`, {});
        return response.data;
    },

    // POST /admin/users/:userId/reset-pin
    resetUserPin: async (userId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/reset-pin`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/lock
    lockUser: async (userId: string): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/lock`, {});
        return response.data;
    },

    // POST /admin/users/:userId/unlock
    unlockUser: async (userId: string): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/unlock`, {});
        return response.data;
    },

    // POST /admin/users/:userId/disable
    disableUser: async (userId: string): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/disable`, {});
        return response.data;
    },

    // POST /admin/users/:userId/enable
    enableUser: async (userId: string): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/enable`, {});
        return response.data;
    },

    // POST /admin/users/:userId/fund-wallet
    fundUserWallet: async (userId: string, payload: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/fund-wallet`, payload);
        return response.data;
    },

    // POST /admin/users/:userId/reset-password/approve
    approveResetUserPassword: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/reset-password/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/reset-pin/approve
    approveResetUserPin: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/reset-pin/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/lock/approve
    approveLockUser: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/lock/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/unlock/approve
    approveUnlockUser: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/unlock/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/disable/approve
    approveDisableUser: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/disable/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/enable/approve
    approveEnableUser: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/enable/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/users/:userId/fund-wallet/approve
    approveFundUserWallet: async (userId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/users/${userId}/fund-wallet/approve`, payload ?? {});
        return response.data;
    },

    // POST /file/upload
    uploadFile: async (file: File): Promise<unknown> => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/file/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
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
    approveLoan: async (loanId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/loans/${loanId}/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/review
    reviewLoan: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/review`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/reject
    rejectLoan: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/reject`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/close
    closeLoan: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/close`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/close/approve
    approveCloseLoan: async (loanId: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/loans/${loanId}/close/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/mark-overdue
    markLoanOverdue: async (loanId: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/mark-overdue`, payload ?? {});
        return response.data;
    },

    // POST /admin/loans/:loanId/create-app-loan
    createAppLoanFromLoan: async (loanId: string): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/create-app-loan`, {});
        return response.data;
    },

    // POST /admin/loans/:loanId/sync-bankone-status
    syncLoanBankoneStatus: async (loanId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/loans/${loanId}/sync-bankone-status`, payload);
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
    scoreAppLoan: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/score`, payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/:id/review
    reviewAppLoan: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/review`, payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/:id/approve
    approveAppLoan: async (id: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/app-loans/${id}/approve`, payload ?? {});
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
    },

    // POST /app-loans/:id/manual-repayment
    submitManualRepayment: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/app-loans/${id}/manual-repayment`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/manual-repayment/approve
    approveAppLoanManualRepayment: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/manual-repayment/approve`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/manual-repayment/reject
    rejectAppLoanManualRepayment: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/manual-repayment/reject`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/close
    closeAppLoan: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/close`, payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/:id/close/approve
    approveCloseAppLoan: async (id: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/app-loans/${id}/close/approve`, payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/:id/mark-overdue
    markAppLoanOverdue: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/mark-overdue`, payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/mark-overdue
    markAllAppLoansOverdue: async (payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/app-loans/mark-overdue', payload ?? {});
        return response.data;
    },

    // POST /admin/app-loans/:id/reschedule
    rescheduleAppLoan: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/app-loans/${id}/reschedule`, payload);
        return response.data;
    },

    // POST /admin/app-loans/:id/reschedule/approve
    approveRescheduleAppLoan: async (id: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/app-loans/${id}/reschedule/approve`, payload ?? {});
        return response.data;
    },

    // GET /admin/reports/center
    getReportCenter: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/center', { params });
        return response.data;
    },

    // GET /admin/reports/export/:type
    downloadReportExport: async (
        type: string,
        params?: QueryParams,
    ): Promise<{ blob: Blob; filename: string; contentType: string }> => {
        const response = await api.get(`/admin/reports/export/${encodeURIComponent(type)}`, {
            params,
            responseType: 'blob',
        });
        const contentDisposition = getHeaderValue(response.headers, 'content-disposition');
        const contentType = getHeaderValue(response.headers, 'content-type') || 'application/octet-stream';
        const extension = inferExtensionFromType(contentType, 'csv');
        const filename = parseFilenameFromDisposition(contentDisposition) || `${type}-report.${extension}`;

        return {
            blob: response.data as Blob,
            filename,
            contentType,
        };
    },

    // GET /admin/reports/financial
    getFinancialReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/financial', { params });
        return response.data;
    },

    // GET /admin/reports/loan-performance
    getLoanPerformanceReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/loan-performance', { params });
        return response.data;
    },

    // GET /admin/reports/profit-loss
    getProfitLossReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/profit-loss', { params });
        return response.data;
    },

    // GET /admin/reports/revenue
    getRevenueReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/revenue', { params });
        return response.data;
    },

    // GET /admin/reports/bill-profit
    getBillProfitReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/bill-profit', { params });
        return response.data;
    },

    // GET /admin/reports/payin-payout-profit
    getPayinPayoutProfitReport: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reports/payin-payout-profit', { params });
        return response.data;
    },

    // GET /admin/general-ledger/bills
    getGeneralLedgerBills: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/general-ledger/bills', { params });
        return response.data;
    },

    // GET /admin/general-ledger/bills/summary
    getGeneralLedgerBillsSummary: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/general-ledger/bills/summary', { params });
        return response.data;
    },

    // POST /admin/general-ledger/bills/backfill
    backfillGeneralLedgerBills: async (payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/general-ledger/bills/backfill', payload ?? {});
        return response.data;
    },

    // POST /admin/referrals/backfill
    queueReferralBackfill: async (payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/referrals/backfill', payload ?? {});
        return response.data;
    },

    // GET /admin/referrals/backfill-jobs/:id
    getReferralBackfillJob: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/referrals/backfill-jobs/${id}`);
        return response.data;
    },

    // GET /admin/audit-logs
    getAuditLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/audit-logs', { params });
        return response.data;
    },

    // GET /admin/admins/:id/audit-logs
    getAdminAuditLogs: async (id: string, params?: QueryParams): Promise<unknown> => {
        const response = await api.get(`/admin/admins/${id}/audit-logs`, { params });
        return response.data;
    },

    // GET /admin/wallet-transactions
    getWalletTransactions: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/wallet-transactions', { params });
        return response.data;
    },

    // POST /admin/wallet-transactions/:id/reverse
    reverseWalletTransaction: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/wallet-transactions/${id}/reverse`, payload ?? {});
        return response.data;
    },

    // POST /admin/wallet-transactions/:id/reverse/approve
    approveReverseWalletTransaction: async (id: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/wallet-transactions/${id}/reverse/approve`, payload ?? {});
        return response.data;
    },

    // GET /admin/xpress-webhook-logs
    getXpressWebhookLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/xpress-webhook-logs', { params });
        return response.data;
    },

    // GET /admin/vtpass-webhook-logs
    getVtpassWebhookLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/vtpass-webhook-logs', { params });
        return response.data;
    },

    // POST /admin/vtpass-webhook-logs/:id/reprocess
    reprocessVtpassWebhookLog: async (id: string): Promise<unknown> => {
        const response = await api.post(`/admin/vtpass-webhook-logs/${id}/reprocess`, {});
        return response.data;
    },

    // GET /admin/transfers
    getTransfers: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/transfers', { params });
        return response.data;
    },

    // GET /admin/transfers/:id
    getTransferById: async (id: string): Promise<unknown> => {
        const response = await api.get(`/admin/transfers/${id}`);
        return response.data;
    },

    // POST /admin/transfers/:id/reverse
    reverseTransfer: async (id: string, payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/transfers/${id}/reverse`, payload ?? {});
        return response.data;
    },

    // POST /admin/transfers/:id/reverse/approve
    approveReverseTransfer: async (id: string, payload?: AdminPayload): Promise<LoginResponse> => {
        const response = await api.post(`/admin/transfers/${id}/reverse/approve`, payload ?? {});
        return response.data;
    },

    // GET /admin/reconciliation/overview
    getReconciliationOverview: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reconciliation/overview', { params });
        return response.data;
    },

    // GET /admin/reconciliation/deposits
    getReconciliationDeposits: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reconciliation/deposits', { params });
        return response.data;
    },

    // GET /admin/reconciliation/transfers
    getReconciliationTransfers: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reconciliation/transfers', { params });
        return response.data;
    },

    // GET /admin/reconciliation/webhooks
    getReconciliationWebhooks: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/reconciliation/webhooks', { params });
        return response.data;
    },

    // GET /admin/email-logs
    getEmailLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/email-logs', { params });
        return response.data;
    },

    // GET /admin/security-events
    getSecurityEvents: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/security-events', { params });
        return response.data;
    },

    // GET /admin/push-notification-logs
    getPushNotificationLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/push-notification-logs', { params });
        return response.data;
    },

    // GET /admin/prembly-logs
    getPremblyLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/prembly-logs', { params });
        return response.data;
    },

    // GET /admin/kycs/recent
    getRecentKycs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/kycs/recent', { params });
        return response.data;
    },

    // POST /admin/mixpanel/test-event
    sendMixpanelTestEvent: async (payload?: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/mixpanel/test-event', payload ?? {});
        return response.data;
    },

    // GET /admin/mixpanel-logs
    getMixpanelLogs: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/mixpanel-logs', { params });
        return response.data;
    },

    // GET /admin/fees
    getFees: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/fees', { params });
        return response.data;
    },

    // GET /admin/fees/bill-pricing
    getBillPricingFees: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/fees/bill-pricing', { params });
        return response.data;
    },

    // POST /admin/fees/default
    setDefaultFee: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/fees/default', payload);
        return response.data;
    },

    // POST /admin/users/:userId/fees
    setUserFee: async (userId: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/users/${userId}/fees`, payload);
        return response.data;
    },

    // POST /admin/fees/bill-pricing
    createBillPricingFee: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/fees/bill-pricing', payload);
        return response.data;
    },

    // PATCH /admin/fees/bill-pricing/:id
    updateBillPricingFee: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/fees/bill-pricing/${id}`, payload);
        return response.data;
    },

    // POST /admin/fees/bill-pricing/calculate
    calculateBillPricingFee: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/fees/bill-pricing/calculate', payload);
        return response.data;
    },

    // GET /admin/fees/resolve
    resolveFee: async (params?: QueryParams): Promise<unknown> => {
        const response = await api.get('/admin/fees/resolve', { params });
        return response.data;
    },

    // POST /fees/calculate
    calculateFee: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/fees/calculate', payload);
        return response.data;
    },

    // GET /admin/system-settings
    getSystemSettings: async (): Promise<unknown> => {
        const response = await api.get('/admin/system-settings');
        return response.data;
    },

    // GET /admin/system-settings/:name
    getSystemSettingByName: async (name: string): Promise<unknown> => {
        const response = await api.get(`/admin/system-settings/${encodeURIComponent(name)}`);
        return response.data;
    },

    // POST /admin/system-settings
    createSystemSetting: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/system-settings', payload);
        return response.data;
    },

    // POST /admin/system-settings/upsert
    upsertSystemSetting: async (payload: AdminPayload): Promise<unknown> => {
        const response = await api.post('/admin/system-settings/upsert', payload);
        return response.data;
    },

    // PATCH /admin/system-settings/:name
    updateSystemSetting: async (name: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.patch(`/admin/system-settings/${encodeURIComponent(name)}`, payload);
        return response.data;
    },

    // POST /admin/system-settings/bulk-upsert
    bulkUpsertSystemSettings: async (payload: { settings: AdminPayload[] }): Promise<unknown> => {
        const response = await api.post('/admin/system-settings/bulk-upsert', payload);
        return response.data;
    },

    // DELETE /admin/system-settings/:name
    deleteSystemSetting: async (name: string): Promise<unknown> => {
        const response = await api.delete(`/admin/system-settings/${encodeURIComponent(name)}`);
        return response.data;
    },

    // POST /admin/admins/:id/revoke-sessions
    revokeAdminSessions: async (id: string, payload: AdminPayload): Promise<unknown> => {
        const response = await api.post(`/admin/admins/${id}/revoke-sessions`, payload);
        return response.data;
    },
};
