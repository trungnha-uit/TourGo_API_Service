const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');

async function checkBookingCompleted(userId, hotelId, tourId) {
    const query = supabase
        .from('bookings')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'COMPLETED')
        .limit(1);

    if (hotelId) {
        query.eq('hotel_id', hotelId);
    } else if (tourId) {
        query.eq('tour_id', tourId);
    }

    const { data, error } = await query.maybeSingle();
    return { data, error };
}

exports.getReviews = async (req, res) => {
    try {
        const { hotelId, tourId } = req.query;

        if (!hotelId && !tourId) {
            return res.status(400).json({
                success: false,
                data: null,
                error: Error_CODES.MISSING_PARAMETER,
                message: 'Either hotelId or tourId is required'
            });
        }

        const tableName = hotelId ? 'hotel_reviews' : 'tour_reviews';
        const imageTable = hotelId ? 'hotel_review_images' : 'tour_review_images';
        const filterColumn = hotelId ? 'hotel_id' : 'tour_id';
        const filterId = hotelId || tourId;

        const { data, error } = await supabase
            .from(tableName)
            .select(`id, ${filterColumn}, user_id, review_text, stars, created_at, users!${tableName}_user_id_users_fkey(name, avatar), ${imageTable}(image_url)`)
            .eq(filterColumn, filterId)
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

exports.createReview = async (req, res) => {
    try {
        const { hotel_id, tour_id } = req.body;
        const userId = req.user.id;

        if (!hotel_id && !tour_id) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_PARAMETER,
                message: 'Either hotel_id or tour_id is required'
            });
        }

        const { data: booking, error: bookingError } = await checkBookingCompleted(userId, hotel_id, tour_id);

        if (bookingError) {
            console.error('Booking check error:', bookingError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: bookingError.message
            });
        }

        if (!booking) {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.BOOKING_ERROR,
                message: `You must complete a booking before reviewing this ${hotel_id ? 'hotel' : 'tour'}`
            });
        }

        const tableName = hotel_id ? 'hotel_reviews' : 'tour_reviews';
        const filterColumn = hotel_id ? 'hotel_id' : 'tour_id';
        const filterId = hotel_id || tour_id;

        const { data: existingReview } = await supabase
            .from(tableName)
            .select('id')
            .eq('user_id', userId)
            .eq(filterColumn, filterId)
            .limit(1)
            .single();

        if (existingReview) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.REVIEW_EXISTS,
                message: `You have already reviewed this ${hotel_id ? 'hotel' : 'tour'}`
            });
        }

        const reviewData = {
            ...req.body,
            user_id: userId
        };

        const { data, error } = await supabase
            .from(tableName)
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

exports.updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;
        const userId = req.user.id;

        if (!type || (type !== 'hotel' && type !== 'tour')) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_TYPE,
                message: 'Type must be either "hotel" or "tour"'
            });
        }

        const tableName = type === 'hotel' ? 'hotel_reviews' : 'tour_reviews';
        const filterColumn = type === 'hotel' ? 'hotel_id' : 'tour_id';

        const { data: existingReview, error: reviewError } = await supabase
            .from(tableName)
            .select(filterColumn)
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (reviewError || !existingReview) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Review not found'
            });
        }

        const hotelId = type === 'hotel' ? existingReview.hotel_id : null;
        const tourId = type === 'tour' ? existingReview.tour_id : null;

        const { data: booking, error: bookingError } = await checkBookingCompleted(userId, hotelId, tourId);

        if (bookingError) {
            console.error('Booking check error:', bookingError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: bookingError.message
            });
        }

        if (!booking) {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.BOOKING_ERROR,
                message: 'You must have a completed booking to update this review'
            });
        }

        const { data, error } = await supabase
            .from(tableName)
            .update(req.body)
            .eq('id', id)
            .eq('user_id', userId)
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

exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;

        if (!type || (type !== 'hotel' && type !== 'tour')) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_TYPE,
                message: 'Type must be either "hotel" or "tour"'
            });
        }

        const tableName = type === 'hotel' ? 'hotel_reviews' : 'tour_reviews';

        const { error } = await supabase
            .from(tableName)
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
        const { reviewId } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_FILE,
                message: 'Image file is required'
            });
        }

        const file = req.file;
        const fileExt = file.mimetype.split('/')[1];
        const fileName = `reviews/${reviewId}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('review-images')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: uploadError.message
            });
        }

        const { data: { publicUrl } } = supabase.storage
            .from('review-images')
            .getPublicUrl(fileName);

        res.status(200).json({
            success: true,
            data: {
                imageUrl: publicUrl,
                fileName: fileName
            },
            error: null,
            message: 'Image uploaded successfully'
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
        const { type } = req.query;

        if (!type || (type !== 'hotel' && type !== 'tour')) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.INVALID_TYPE,
                message: 'Type must be either "hotel" or "tour"'
            });
        }

        const tableName = type === 'hotel' ? 'hotel_review_images' : 'tour_review_images';

        const { data, error } = await supabase
            .from(tableName)
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

exports.getBusinessReviews = async (req, res) => {
    try {
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', req.user.id)
            .single();

        if (bizError || !business) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Business profile not found'
            });
        }

        // 1. Fetch tours
        const { data: tours } = await supabase
            .from('tours')
            .select('id, name')
            .eq('businesses_id', business.id);
        const tourIds = tours ? tours.map(t => t.id) : [];
        const tourNames = {};
        if (tours) tours.forEach(t => tourNames[t.id] = t.name);

        // 2. Fetch hotels (defensive)
        let hotelIds = [];
        const hotelNames = {};
        try {
            const { data: hotels } = await supabase
                .from('hotels')
                .select('id, name')
                .eq('businesses_id', business.id);
            if (hotels) {
                hotels.forEach(h => {
                    hotelIds.push(h.id);
                    hotelNames[h.id] = h.name;
                });
            }
        } catch (e) {
            console.warn('Hotels query in getBusinessReviews failed:', e.message);
        }

        const allReviews = [];

        // 3. Fetch tour reviews
        if (tourIds.length > 0) {
            const { data: tourReviews } = await supabase
                .from('tour_reviews')
                .select('id, tour_id, user_id, review_text, stars, created_at, users(name, avatar)')
                .in('tour_id', tourIds);
            
            if (tourReviews) {
                tourReviews.forEach(r => {
                    allReviews.push({
                        id: r.id,
                        rating: r.stars,
                        name: r.users ? r.users.name : 'Unknown User',
                        avatar: r.users ? r.users.avatar : null,
                        body: r.review_text,
                        listing: tourNames[r.tour_id] || 'Tour',
                        category: 'tour',
                        created_at: r.created_at
                    });
                });
            }
        }

        // 4. Fetch hotel reviews
        if (hotelIds.length > 0) {
            const { data: hotelReviews } = await supabase
                .from('hotel_reviews')
                .select('id, hotel_id, user_id, review_text, stars, created_at, users(name, avatar)')
                .in('hotel_id', hotelIds);

            if (hotelReviews) {
                hotelReviews.forEach(r => {
                    allReviews.push({
                        id: r.id,
                        rating: r.stars,
                        name: r.users ? r.users.name : 'Unknown User',
                        avatar: r.users ? r.users.avatar : null,
                        body: r.review_text,
                        listing: hotelNames[r.hotel_id] || 'Hotel',
                        category: 'hotel',
                        created_at: r.created_at
                    });
                });
            }
        }

        // Sort reviews by created_at descending
        allReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.status(200).json({
            success: true,
            data: allReviews,
            error: null,
            message: 'Reviews retrieved successfully'
        });

    } catch (error) {
        console.error('Get business reviews error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};
