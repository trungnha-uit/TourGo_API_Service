const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllTours = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tours')
            .select('*, tour_images(*)')
            .eq('status', 'APPROVED')
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
            message: 'Tours retrieved successfully'
        });

    } catch (error) {
        console.error('Get tours error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getTourById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('tours')
            .select('*, tour_images(*)')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Tour not found'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Tour retrieved successfully'
        });

    } catch (error) {
        console.error('Get tour by id error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.searchTours = async (req, res) => {
    try {
        const { q, region, min_price, max_price, min_rating, sort_by, order } = req.query;

        let query = supabase
            .from('tours')
            .select('*, tour_images(*)')
            .eq('status', 'APPROVED');

        // Text search
        if (q) {
            query = query.ilike('name', `%${q}%`);
        }

        // Region filter
        if (region) {
            query = query.eq('region', region);
        }

        // Price range
        if (min_price) {
            query = query.gte('price', min_price);
        }
        if (max_price) {
            query = query.lte('price', max_price);
        }

        // Rating filter
        if (min_rating) {
            query = query.gte('rating', min_rating);
        }

        // Sorting
        const sortField = sort_by || 'created_at';
        const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };
        query = query.order(sortField, sortOrder);

        const {data, error} = await query;

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
        console.error('Search tours error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};