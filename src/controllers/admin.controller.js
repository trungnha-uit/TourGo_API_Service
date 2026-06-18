const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Record one moderation action in the audit_logs table. Best-effort only —
 * any failure (e.g. the table not yet created) is swallowed so it can never
 * break the action that triggered it.
 */
async function logAudit(req, action, kind) {
    try {
        let actorName = req.user && req.user.email ? req.user.email : null;
        const actorId = req.user ? req.user.id : null;
        if (actorId) {
            const { data: profile } = await supabase
                .from('users')
                .select('name')
                .eq('id', actorId)
                .single();
            if (profile && profile.name) actorName = profile.name;
        }
        await supabase.from('audit_logs').insert({
            action,
            actor_id: actorId,
            actor_name: actorName,
            kind
        });
    } catch (e) {
        console.warn('Audit log skipped:', e.message);
    }
}

exports.getAllUsers = async (req, res) => {
    try {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, status, create_at, location')
            .order('create_at', { ascending: false });

        if (usersError) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: usersError.message
            });
        }

        const { data: allBookings } = await supabase
            .from('bookings')
            .select('user_id');

        const bookingCounts = {};
        if (allBookings) {
            allBookings.forEach(b => {
                bookingCounts[b.user_id] = (bookingCounts[b.user_id] || 0) + 1;
            });
        }

        // Open-report counts per user, keyed by display name (best-effort — the
        // reports table may not exist yet, in which case this stays empty).
        const reportCounts = {};
        try {
            const { data: openReports } = await supabase
                .from('reports')
                .select('target')
                .eq('status', 'open');
            if (openReports) {
                openReports.forEach(r => {
                    if (r.target) reportCounts[r.target] = (reportCounts[r.target] || 0) + 1;
                });
            }
        } catch (e) {
            console.warn('Report counts skipped:', e.message);
        }

        const usersWithMetadata = users.map(user => {
            const bookingsCount = bookingCounts[user.id] || 0;

            let tier = 'Bronze';
            if (bookingsCount >= 20) tier = 'Gold';
            else if (bookingsCount >= 10) tier = 'Silver';

            return {
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.status,
                bookings: bookingsCount,
                reported: reportCounts[user.name] || 0,
                tier: tier,
                location: user.location,
                created_at: user.create_at
            };
        });

        res.status(200).json({
            success: true,
            data: usersWithMetadata,
            error: null,
            message: 'Users retrieved successfully'
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.suspendUser = async (req, res) => {
    try {
        const { userId } =req.params;
        
        const { error } = await supabase
            .from('users')
            .update({ status: 'suspended'})
            .eq('id', userId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: u } = await supabase.from('users').select('name').eq('id', userId).single();
        await logAudit(req, `Suspended user ${u && u.name ? u.name : userId}`, 'suspend');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'User suspended successfully'
        });
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.flagUser = async (req, res) => {
    try {
        const { userId } =req.params;
        
        const { error } = await supabase
            .from('users')
            .update({ status: 'flagged'})
            .eq('id', userId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: u } = await supabase.from('users').select('name').eq('id', userId).single();
        await logAudit(req, `Flagged user ${u && u.name ? u.name : userId}`, 'revision');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'User flagged successfully'
        });
    } catch (error) {
        console.error('Flag user error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.activateUser = async (req, res) => {
    try {
        const { userId } =req.params;
        
        const { error } = await supabase
            .from('users')
            .update({ status: 'active'})
            .eq('id', userId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: u } = await supabase.from('users').select('name').eq('id', userId).single();
        await logAudit(req, `Activated user ${u && u.name ? u.name : userId}`, 'approve');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'User activated successfully'
        });
    } catch (error) {
        console.error('Activate user error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.getPendingBusinesses = async (req, res) => {
    try {
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: businesses || [],
            error: null,
            message: 'Pending businesses retrieved successfully'
        });
    } catch (error) {
        console.error('Get pending businesses error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.approveBusiness = async (req, res) => {
    try {
        // businessId ở đây thực chất là User ID được gửi từ App Android
        const { businessId: userId } = req.params; 
        const adminId = req.user.id;

        // 1. Tìm đơn đăng ký (business) của User này đang ở trạng thái pending
        const { data: businessData, error: fetchError } = await supabase
            .from('businesses')
            .select('id, user_id, name')
            .eq('user_id', userId) // Tìm theo user_id
            .eq('status', 'pending')
            .single();

        if (fetchError || !businessData) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đơn đăng ký kinh doanh đang chờ của người dùng này'
            });
        }

        // 2. Cập nhật trạng thái Business đó thành 'active'
        const { error: bizError } = await supabase
            .from('businesses')
            .update({ status: 'active', reviewed_by: adminId, reviewed_at: new Date() })
            .eq('id', businessData.id); // Update đúng ID của business

        if (bizError) throw bizError;

        // 3. Cập nhật role thành 'business' trong bảng 'users' (như bạn xác nhận)
        const { error: roleError } = await supabase
            .from('users') 
            .update({ role: 'business' })
            .eq('id', userId);

        if (roleError) console.error('Lỗi cập nhật role:', roleError.message);

        await logAudit(req, `Approved business ${businessData.name}`, 'approve');

        res.status(200).json({
            success: true,
            message: 'Đã phê duyệt đối tác và nâng cấp quyền thành công!'
        });
    } catch (error) {
        console.error('Approve business error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
exports.suspendBusiness = async (req, res) => {
    try {
        const { businessId } = req.params;

        const { error } = await supabase
            .from('businesses')
            .update({ status: 'suspended'})
            .eq('id', businessId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: b } = await supabase.from('businesses').select('name').eq('id', businessId).single();
        await logAudit(req, `Suspended business ${b && b.name ? b.name : businessId}`, 'suspend');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Business suspended successfully'
        });
    } catch (error) {
        console.error('Suspend business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
}

exports.rejectBusiness = async (req, res) => {
    try {
        const { businessId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;

        const { error } = await supabase
            .from('businesses')
            .update({ status: 'rejected', reviewed_by: adminId, reviewed_at: new Date(), rejection_reason: reason || null })
            .eq('id', businessId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: b } = await supabase.from('businesses').select('name').eq('id', businessId).single();
        await logAudit(req, `Rejected business ${b && b.name ? b.name : businessId}`, 'reject');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Business rejected successfully'
        });
    } catch (error) {
        console.error('Reject business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
}

// Count helper — runs a head/count query and returns 0 if the table/filter errors.
async function countRows(table, filters) {
    try {
        let q = supabase.from(table).select('*', { count: 'exact', head: true });
        (filters || []).forEach(f => { q = q.eq(f[0], f[1]); });
        const { count, error } = await q;
        if (error) return 0;
        return count || 0;
    } catch (e) {
        return 0;
    }
}

// ── Dashboard KPIs (Admin › Home) ──────────────────────────────────────────
exports.getStats = async (req, res) => {
    try {
        const [users, businesses, listings, pendingListings, pendingBusinesses, reports, flagged] =
            await Promise.all([
                countRows('users', [['role', 'user']]),
                countRows('businesses', [['status', 'active']]),
                countRows('tours', []),
                countRows('tours', [['status', 'PENDING']]),
                countRows('businesses', [['status', 'pending']]),
                countRows('reports', [['status', 'open']]),
                countRows('users', [['status', 'flagged']]),
            ]);

        res.status(200).json({
            success: true,
            data: {
                users,
                businesses,
                listings,
                pending_listings: pendingListings,
                pending_businesses: pendingBusinesses,
                reports,
                flagged_users: flagged
            },
            error: null,
            message: 'Stats retrieved successfully'
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

// ── Recent activity feed (Admin › Home) ────────────────────────────────────
exports.getActivity = async (req, res) => {
    try {
        const events = [];

        const { data: businesses } = await supabase
            .from('businesses')
            .select('name, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
        (businesses || []).forEach(b => events.push({
            kind: 'business',
            bold: b.name || 'A business',
            rest: ' registered as a new business',
            meta: b.status === 'pending' ? 'Awaiting approval' : 'Business account',
            created_at: b.created_at
        }));

        const { data: tours } = await supabase
            .from('tours')
            .select('name, region, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
        (tours || []).forEach(t => events.push({
            kind: 'tour',
            bold: t.name || 'A listing',
            rest: ' submitted a new listing',
            meta: t.region ? ('Tour · ' + t.region) : 'Tour',
            created_at: t.created_at
        }));

        try {
            const { data: reports } = await supabase
                .from('reports')
                .select('type, target, reporter, created_at')
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(5);
            (reports || []).forEach(r => events.push({
                kind: 'report',
                bold: r.target || 'a user',
                rest: r.type ? (' reported for ' + r.type.toLowerCase()) : ' was reported',
                meta: r.reporter ? ('Filed by ' + r.reporter) : 'New report',
                created_at: r.created_at
            }));
        } catch (e) {
            console.warn('Activity reports skipped:', e.message);
        }

        events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json({
            success: true,
            data: events.slice(0, 8),
            error: null,
            message: 'Activity retrieved successfully'
        });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

// ── Admin team (Admin › Profile › Admin team) ──────────────────────────────
exports.getTeam = async (req, res) => {
    try {
        const { data: admins, error } = await supabase
            .from('users')
            .select('id, name, email, create_at')
            .eq('role', 'admin')
            .order('create_at', { ascending: true });

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const team = (admins || []).map(a => ({
            id: a.id,
            name: a.name,
            email: a.email,
            role: 'Admin'
        }));

        res.status(200).json({
            success: true,
            data: team,
            error: null,
            message: 'Admin team retrieved successfully'
        });
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

// ── User reports (Admin › Moderation › Reports) ────────────────────────────
exports.getReports = async (req, res) => {
    try {
        const { data: reports, error } = await supabase
            .from('reports')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: reports || [],
            error: null,
            message: 'Reports retrieved successfully'
        });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

// Shared resolver for the report action endpoints (dismiss / resolve).
async function setReportStatus(req, res, status, kindLabel) {
    try {
        const { reportId } = req.params;
        const adminId = req.user ? req.user.id : null;

        const { data: report } = await supabase
            .from('reports')
            .select('target, type')
            .eq('id', reportId)
            .single();

        const { error } = await supabase
            .from('reports')
            .update({ status, resolved_by: adminId, resolved_at: new Date() })
            .eq('id', reportId);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const targetName = report && report.target ? report.target : reportId;
        await logAudit(req, `${kindLabel} report on ${targetName}`,
            status === 'dismissed' ? 'reject' : 'approve');

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: `Report ${status} successfully`
        });
    } catch (error) {
        console.error('Set report status error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
}

exports.dismissReport = (req, res) => setReportStatus(req, res, 'dismissed', 'Dismissed');
exports.resolveReport = (req, res) => setReportStatus(req, res, 'resolved', 'Resolved');

// ── Audit log (Admin › Profile › Audit log) ────────────────────────────────
exports.getAuditLog = async (req, res) => {
    try {
        const { data: logs, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: logs || [],
            error: null,
            message: 'Audit log retrieved successfully'
        });
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};