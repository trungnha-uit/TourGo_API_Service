const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getReviewsByHotelId = async (req, res) => {
    try {
        const { hotelId } = req.query;

        if (!hotelId) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'MISSING_HOTEL_ID',
                message: 'Hotel ID is required'
            });
        }

        const { data, error } = await supabase
            .from('hotel_reviews')
            .select('id, hotel_id, user_id, review_text, stars, created_at, users!hotel_reviews_user_id_users_fkey(name, avatar), hotel_review_images(image_url)')
            .eq('hotel_id', hotelId)
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
            message: 'Reviews retrieved successfully'
        });

    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.createHotelReview = async (req, res) => {
    try {
        const reviewData = {
            ...req.body,
            user_id: req.user.id
        };

        const { data, error } = await supabase
            .from('hotel_reviews')
            .insert([reviewData])
            .select()
            .single();

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
            message: 'Review created successfully'
        });

    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.updateHotelReview = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('hotel_reviews')
            .update(req.body)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Review not found'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Review updated successfully'
        });

    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.deleteHotelReview = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('hotel_reviews')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Review not found'
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Review deleted successfully'
        });

    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.uploadReviewImage = async (req, res) => {
    try {
        res.status(501).json({
            success: false,
            data: null,
            error: 'NOT_IMPLEMENTED',
            message: 'Image upload not implemented yet'
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.saveReviewImages = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hotel_review_images')
            .insert([req.body])
            .select()
            .single();

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
            message: 'Review image saved successfully'
        });

    } catch (error) {
        console.error('Save review image error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
