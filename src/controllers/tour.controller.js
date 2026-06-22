const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const notificationService = require('../services/notification.service');

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

exports.createTour = async (req, res) => {
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

        const maxParticipants = parseInt(req.body.max_participants, 10);
        const price = parseFloat(req.body.price);

        if (isNaN(maxParticipants) || maxParticipants < 1 || maxParticipants > 500) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Số lượng người tham gia tối đa phải nằm trong khoảng từ 1 đến 500.'
            });
        }

        if (isNaN(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Giá tour phải lớn hơn 0.'
            });
        }

        const tourData = {
            ...req.body,
            price: price,
            max_participants: maxParticipants,
            status: 'PENDING',
            businesses_id: business.id
        };

        const { data, error } = await supabase
            .from('tours')
            .insert([tourData])
            .select('*');

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
            data: data[0],
            error: null,
            message: 'Tour created successfully'
        });
    } catch (error) {
        console.error('Create tour error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
}

exports.uploadTourImages = async (req, res) => {
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
        const fileName = `tour/${id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase
            .storage
            .from('tour-images')
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
            .from('tour-images')
            .getPublicUrl(fileName);

        // Insert image record into the database table
        const { error: dbError } = await supabase
            .from('tour_images')
            .insert([{ tour_id: id, image_url: publicUrl }]);

        if (dbError) {
            console.error('Save tour image DB error:', dbError);
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
        console.error('Upload tour image error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.getPendingTours = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tours')
            .select('*, tour_images(*)')
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
            message: 'Pending tours retrieved successfully'
        });
    } catch (error) {
        console.error('Get pending tours error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.approveTour = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('tours')
            .update({ status: 'APPROVED' })
            .eq('id', id)
            .select('id, name, businesses_id');

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        if (data && data.length > 0) {
            // Trigger best-effort notification to business owner
            notificationService.notifyListingApprovalStatus(data[0], 'tour', 'APPROVED');
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Tour approved successfully'
        });
    } catch (error) {
        console.error('Approve tour error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.rejectTour = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('tours')
            .update({ status: 'REJECTED' })
            .eq('id', id)
            .select('id, name, businesses_id');

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        if (data && data.length > 0) {
            // Trigger best-effort notification to business owner
            notificationService.notifyListingApprovalStatus(data[0], 'tour', 'REJECTED');
        }

        res.status(200).json({
            success: true,
            data: null,
            error: null,
            message: 'Tour rejected successfully'
        });
    } catch (error) {
        console.error('Reject tour error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};