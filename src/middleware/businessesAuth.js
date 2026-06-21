const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

const businessesAuth = async (req, res, next) => {
    try {
        const { data: business, error: dbError } = await supabase
            .from('businesses')
            .select('id, status')
            .eq('user_id', req.user.id)
            .single();

        // 1. Trường hợp không tìm thấy doanh nghiệp
        if (!business) {
            return res.status(404).json({
                success: false,
                data: { status: 'not_found' }, // Trả về trạng thái cụ thể
                error: ERROR_CODES.NO_BUSINESS,
                message: 'No business profile found for this user'
            });
        }

        // 2. Trường hợp doanh nghiệp tồn tại nhưng chưa 'active'
        if (business.status !== 'active') {
            return res.status(403).json({
                success: false,
                data: { status: business.status }, // Trả về status thực tế (ví dụ: 'pending', 'rejected')
                error: ERROR_CODES.BUSINESS_NOT_APPROVED,
                message: `Business profile is currently: ${business.status}`
            });
        }

        // 3. Nếu mọi thứ hợp lệ, đính kèm business vào req để các middleware sau dùng được
        req.business = business; 
        next();
    } catch (error) {
        console.error('Business auth error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

module.exports = businessesAuth;