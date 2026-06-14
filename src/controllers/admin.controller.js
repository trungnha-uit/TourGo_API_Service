const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

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
                reported: 0,  // TODO: Thêm khi có bảng reports
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
        const { businessId } = req.params;
        const adminId = req.user.id;

        const { error } = await supabase
            .from('businesses')
            .update({ status: 'active', reviewed_by: adminId, reviewed_at: new Date() })
            .eq('id', businessId);

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
            data: null,
            error: null,
            message: 'Business approved successfully'
        });
    } catch (error) {
        console.error('Approve business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
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