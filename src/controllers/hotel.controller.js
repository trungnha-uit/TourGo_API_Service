const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllHotels = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hotels')
            .select('*, hotel_images(*)')
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
        const { q, city, min_price, max_price, min_rating, sort_by, order } = req.query;

        let query = supabase
            .from('hotels')
            .select('*, hotel_images(*)');

        if (q) {
            query = query.ilike('name', `%${q}%`);
        }
        if (city) {
            query = query.ilike('city', `%${city}%`);
        }
        if (min_price) {
            query = query.gte('price_per_night', min_price);
        }
        if (max_price) {
            query = query.lte('price_per_night', max_price);
        }
        if (min_rating) {
            query = query.gte('rating', min_rating);
        }

        const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };
        query = query.order(sort_by, sortOrder);

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

exports.createHotel = async (req, res) => {
    try {
        // Find the business profile associated with this user
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', req.user.id)
            .single();

        if (bizError || !business) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.NO_BUSINESS,
                message: 'No business profile found for this user'
            });
        }

        const hotelData = {
            name: req.body.name,
            description: req.body.description,
            price_per_night: req.body.price,
            address: req.body.city ? (req.body.address + ", " + req.body.city) : req.body.address,
            amenities: Array.isArray(req.body.amenities) ? req.body.amenities.join(', ') : req.body.amenities,
            businesses_id: business.id
        };

        const { data, error } = await supabase
            .from('hotels')
            .insert([hotelData])
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({
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
            message: 'Hotel created successfully'
        });
    } catch (error) {
        console.error('Create hotel error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
