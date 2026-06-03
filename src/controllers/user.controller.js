const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getCurrentUser = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'User not found'
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
            .select('*')
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

exports.registerBusiness = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .insert({
                user_id: req.user.id,
                ...req.body
            });

        if (error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        res.status(201).json({
            success: true,
            data: data,
            error: null,
            message: 'Business registered successfully'
        });

    } catch (error) {
        console.error('Register business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getMyBusiness = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Business not found'
            });
        }

        const { data: toursData, error: toursError } = await supabase
            .from('tours')
            .select('id')
            .eq('businesses_id', data.id);

        const tourIds = toursData ? toursData.map(tour => tour.id) : [];

        const { data: bookingsData, error: bookingsError } = await supabase
            .from('bookings')
            .select('id')
            .in('tour_id', tourIds);

        const bookingIds = bookingsData ? bookingsData.map(booking => booking.id) : [];

        res.status(200).json({
            success: true,
            data: {
                ...data,
                listings: tourIds.length,
                bookings: bookingIds.length
            },
            error: null,
            message: 'Business retrieved successfully'
        });
    } catch (error) {
        console.error('Get my business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.resubmitBusiness = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .update({
                ...req.body,
                status: 'pending'
            })
            .eq('user_id', req.user.id)
            .select('*')
            .single();

        if (error || !data) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error?.message || 'Resubmit failed'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Business resubmitted successfully'
        });
    } catch (error) {
        console.error('Resubmit business error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.updateBusinessProfile = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('businesses')
            .update(req.body)
            .eq('user_id', req.user.id)
            .select('*')
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
            message: 'Business profile updated successfully'
        });
    } catch (error) {
        console.error('Update business profile error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.deleteBusinessAccount = async (req, res) => {
    try {
        const { error } = await supabase
            .from('businesses')
            .delete()
            .eq('user_id', req.user.id);

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
            message: 'Business account deleted successfully'
        });
    } catch (error) {
        console.error('Delete business account error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};