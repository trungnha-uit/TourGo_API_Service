const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

exports.getAllHotels = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hotels')
            .select('*, hotel_images(*)')
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
            .select('*, hotel_images(*)')
            .eq('status', 'APPROVED');

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
            businesses_id: business.id,
            open_from: req.body.open_from || null,
            open_until: req.body.open_until || null,
            blocked_dates: req.body.blocked_dates || null,
            status: 'PENDING'
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

exports.getPendingHotels = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('hotels')
            .select('*, hotel_images(*)')
            .eq('status', 'PENDING')
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
            message: 'Pending hotels retrieved successfully'
        });
    } catch (error) {
        console.error('Get pending hotels error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.approveHotel = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('hotels')
            .update({ status: 'APPROVED' })
            .eq('id', id);

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
            message: 'Hotel approved successfully'
        });
    } catch (error) {
        console.error('Approve hotel error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.rejectHotel = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('hotels')
            .update({ status: 'REJECTED' })
            .eq('id', id);

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
            message: 'Hotel rejected successfully'
        });
    } catch (error) {
        console.error('Reject hotel error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.uploadHotelImages = async (req, res) => {
    try {
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_FILE,
                message: 'No image file uploaded'
            });  
        }

        const file = req.file;
        const fileExt = file.mimetype.split('/')[1];
        const fileName = `hotel/${id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase
            .storage
            .from('hotel-images')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype
            });
            
        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('hotel-images')
            .getPublicUrl(fileName);

        // Insert image record into the database table
        const { error: dbError } = await supabase
            .from('hotel_images')
            .insert([{ hotel_id: id, image_url: publicUrl }]);

        if (dbError) {
            console.error('Save hotel image DB error:', dbError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: dbError.message
            });
        }

        res.status(200).json({
            success: true,
            data: { imageUrl: publicUrl, fileName: fileName },
            error: null,
            message: 'Image uploaded successfully'
        });
    } catch (error) {
        console.error('Upload hotel image error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};
