const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllTours = async (req, res) => {
    try {
        const { q, region } = req.query;

        let query = supabase
            .from('tours')
            .select('*, tour_images(*)')
            .eq('status', 'APPROVED')
            .order('created_at', { ascending: false });

        if (q) {
            query = query.ilike('name', `%${q}%`);
        }

        if (region) {
            query = query.eq('region', region);
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
            .from('tours')
            .select('*, tour_images(*)')
            .eq('status', 'APPROVED')
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
        console.error('Search tours error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.filterToursByRegion = async (req, res) => {
    try {
        const { region } = req.query;

        if (!region) {
            return res.status(400).json({
                success: false,
                data: null,
                error: 'MISSING_REGION',
                message: 'Region parameter is required'
            });
        }

        const { data, error } = await supabase
            .from('tours')
            .select('*, tour_images(*)')
            .eq('status', 'APPROVED')
            .eq('region', region)
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
            message: 'Tours filtered successfully'
        });

    } catch (error) {
        console.error('Filter tours error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
