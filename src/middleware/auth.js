const supabase = require('../config/supabase');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                data: null,
                error: 'UNAUTHORIZED',
                message: 'Authorization header is required'
            });
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                data: null,
                error: 'INVALID_TOKEN',
                message: 'Invalid or expired token'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'SERVER_ERROR',
            message: 'Internal server error'
        });
    }
};

module.exports = auth;
