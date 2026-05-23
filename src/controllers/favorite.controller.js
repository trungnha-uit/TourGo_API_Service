const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getUserFavorites = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', req.user.id);

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
            message: 'Favorites retrieved successfully'
        });

    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.addFavorite = async (req, res) => {
    try {
        const favoriteData = {
            ...req.body,
            user_id: req.user.id
        };

        const { data, error } = await supabase
            .from('favorites')
            .insert([favoriteData])
            .select()
            .single();

        if (error) {
            if (error.message.includes('duplicate') || error.message.includes('unique')) {
                return res.status(200).json({
                    success: true,
                    data: null,
                    error: null,
                    message: 'Already in favorites'
                });
            }
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
            message: 'Added to favorites successfully'
        });

    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Favorite not found'
            });
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Removed from favorites successfully'
        });

    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
