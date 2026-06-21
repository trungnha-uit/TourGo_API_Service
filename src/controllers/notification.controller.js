const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

const VALID_ROLES = ['TRAVELER', 'BUSINESS', 'ADMIN'];
const TABLE_MISSING = '42P01'; // Postgres: relation does not exist (pre-migration)

// GET /api/notifications?role=TRAVELER|BUSINESS
exports.getNotifications = async (req, res) => {
    try {
        const role = (req.query.role || '').toUpperCase();

        let query = supabase
            .from('notifications')
            .select('id, role, category, title, body, icon, data, read, created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (VALID_ROLES.includes(role)) {
            query = query.eq('role', role);
        }

        const { data, error } = await query;

        if (error) {
            // Before the migration is run the table doesn't exist yet — degrade to
            // an empty feed instead of failing the screen.
            if (error.code === TABLE_MISSING) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    error: null,
                    message: 'Notifications table not migrated yet'
                });
            }
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: data || [],
            error: null,
            message: 'Notifications retrieved successfully'
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error && error.code !== TABLE_MISSING) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

// PATCH /api/notifications/read-all?role=TRAVELER|BUSINESS
exports.markAllAsRead = async (req, res) => {
    try {
        const role = (req.query.role || '').toUpperCase();

        let query = supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', req.user.id)
            .eq('read', false);

        if (VALID_ROLES.includes(role)) {
            query = query.eq('role', role);
        }

        const { error } = await query;

        if (error && error.code !== TABLE_MISSING) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
