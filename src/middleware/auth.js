const supabaseAuth = require('../config/supabaseAuth');
const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.UNAUTHORIZED,
                message: 'Authorization header is required'
            });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_TOKEN,
                message: 'Invalid or expired token'
            });
        }

        // The moderation status is stored in the public.users profile table, not
        // in the Supabase auth user — look it up there so a suspended account is
        // blocked on every authenticated request (even with a still-valid token).
        const { data: profile } = await supabase
            .from('users')
            .select('status')
            .eq('id', user.id)
            .single();

        if (profile && profile.status === 'suspended') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.ACCOUNT_SUSPENDED,
                message: 'Tài khoản của bạn đã bị tạm khoá. Vui lòng liên hệ quản trị viên.'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

module.exports = auth;
