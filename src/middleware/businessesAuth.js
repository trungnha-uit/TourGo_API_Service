const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

const businessesAuth = async (req, res, next) => {
    try {
        const { data: business } = await supabase
            .from('businesses')
            .select('id, status')
            .eq('user_id', req.user.id)
            .single();

        if (!business) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NO_BUSINESS,
                message: 'No business profile found for this user'
            });
        }

        if (business.status !== 'active') {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.BUSINESS_NOT_APPROVED,
                message: 'Business profile is not approved yet'
            });
        }

        next();
    } catch (error) {
        console.error('Business auth error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

module.exports = businessesAuth;