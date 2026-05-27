const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, role, avatar, phone, created_at')
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
            data: data,
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

exports.getCurrentUser = async (req, res) => {
    try {
        console.log('=== GET CURRENT USER DEBUG ===');
        console.log('User ID from token:', req.user.id);
        console.log('Full user object:', req.user);

        const { data, error } = await supabase
            .from('users')
            .select('id, name, email, role, avatar, phone, created_at')
            .eq('id', req.user.id)
            .single();

        console.log('Query result - data:', data);
        console.log('Query result - error:', error);

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'User not found',
                debug: {
                    userId: req.user.id,
                    queryError: error
                }
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'User retrieved successfully'
        });

    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(req.body)
            .eq('id', req.user.id)
            .select('id, name, email, role, avatar, phone')
            .single();

        if (error || !data) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error?.message || 'Update failed'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.deleteUserAccount = async (req, res) => {
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.user.id);

        if (error) {
            return res.status(400).json({
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
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
