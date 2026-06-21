const supabase = require('../config/supabaseAuth');
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
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_TOKEN,
                message: 'Invalid or expired token'
            });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.ACCOUNT_SUSPENDED,
                message: 'Account is suspended'
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
