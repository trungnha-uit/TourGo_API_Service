const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

const adminOnly = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.UNAUTHORIZED,
                message: 'Authentication required'
            });
        }

        const { data: userProfile, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (error || !userProfile) {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.FORBIDDEN,
                message: 'User profile not found'
            });
        }

        if (userProfile.role !== 'admin') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.FORBIDDEN,
                message: 'Admin access required'
            });
        }

        next();

    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

module.exports = adminOnly;
