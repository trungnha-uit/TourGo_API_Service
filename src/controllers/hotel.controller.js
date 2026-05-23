const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllHotels = async (req, res) => {
    try {
        const { q } = req.query;

        let query = supabase
            .from('hotels')
            .select('*, hotel_images(*)')
            .order('rating', { ascending: false });

        if (q) {
            query = query.ilike('name', `%${q}%`);
        }

        const { data, error } = await query;

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
            message: 'Hotels retrieved successfully'
        });

    } catch (error) {
        console.error('Get hotels error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getHotelById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('hotels')
            .select('*, hotel_images(*)')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Hotel not found'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Hotel retrieved successfully'
        });

    } catch (error) {
        console.error('Get hotel by id error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.searchHotels = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'MISSING_QUERY',
                message: 'Search query is required'
            });
        }

        const { data, error } = await supabase
            .from('hotels')
            .select('*, hotel_images(*)')
            .ilike('name', `%${q}%`)
            .order('rating', { ascending: false });

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
            message: 'Search completed successfully'
        });

    } catch (error) {
        console.error('Search hotels error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
