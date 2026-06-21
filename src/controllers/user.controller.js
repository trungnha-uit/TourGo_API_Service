const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const emailService = require('../utils/email');

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

        const userId = req.user.id;

        let updateData = {
            ...req.body
        };

        let oldAvatar = null;
        let uploadedPath = null;

        // Lấy user hiện tại
        const {
            data: oldUser,
            error: oldUserError
        } = await supabase
            .from('users')
            .select('avatar')
            .eq('id', userId)
            .maybeSingle();

        if (oldUserError) {
            throw oldUserError;
        }

        if (!oldUser) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'User not found'
            });
        }

        oldAvatar = oldUser.avatar;

        // Upload avatar mới
        if (req.file) {

            const ext =
                req.file.originalname
                    .split('.')
                    .pop();

            uploadedPath =
                `${userId}/${Date.now()}.${ext}`;

            const {
                error: uploadError
            } =
                await supabase
                    .storage
                    .from('avatars')
                    .upload(
                        uploadedPath,
                        req.file.buffer,
                        {
                            contentType:
                                req.file.mimetype,
                            upsert: true
                        }
                    );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data: {
                    publicUrl
                }
            } =
                supabase
                    .storage
                    .from('avatars')
                    .getPublicUrl(
                        uploadedPath
                    );

            updateData.avatar =
                publicUrl;
        }

        // Update DB
        const {
            data,
            error
        } =
            await supabase
                .from('users')
                .update(updateData)
                .eq(
                    'id',
                    userId
                )
                .select()
                .maybeSingle();

        // rollback nếu update fail
        if (error || !data) {

            if (uploadedPath) {

                await supabase
                    .storage
                    .from('avatars')
                    .remove([
                        uploadedPath
                    ]);
            }

            throw error ||
                new Error(
                    'Update failed'
                );
        }

        // Xóa avatar cũ
        if (
            req.file &&
            oldAvatar
        ) {

            const marker =
                '/storage/v1/object/public/avatars/';

            const idx =
                oldAvatar.indexOf(
                    marker
                );

            if (idx !== -1) {

                const oldPath =
                    oldAvatar.substring(
                        idx +
                        marker.length
                    );

                try {

                    await supabase
                        .storage
                        .from(
                            'avatars'
                        )
                        .remove([
                            oldPath
                        ]);

                } catch (
                    deleteErr
                ) {

                    console.warn(
                        'Delete old avatar failed:',
                        deleteErr.message
                    );
                }
            }
        }

        return res
            .status(200)
            .json({
                success: true,
                data,
                error: null,
                message:
                    'Profile updated successfully'
            });

    } catch (error) {

        console.error(
            'Update profile error:',
            error
        );

        return res
            .status(500)
            .json({
                success: false,
                data: null,
                error:
                    ERROR_CODES.SERVER_ERROR,
                message:
                    error.message
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
        // Check if user already has a business registration
        const { data: existing, error: findError } = await supabase
            .from('businesses')
            .select('id, status')
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: findError.message
            });
        }

        if (existing) {
            if (existing.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.SERVER_ERROR,
                    message: 'Bạn đã gửi yêu cầu đăng ký đối tác rồi. Vui lòng chờ quản trị viên phê duyệt.'
                });
            } else if (existing.status === 'active') {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.SERVER_ERROR,
                    message: 'Tài khoản của bạn đã được duyệt thành đối tác.'
                });
            } else if (existing.status === 'rejected') {
                // If rejected, update the existing registration to submit again
                const { data, error } = await supabase
                    .from('businesses')
                    .update({
                        ...req.body,
                        status: 'pending',
                        reviewed_at: null,
                        reviewed_by: null,
                        rejection_reason: null,
                        created_at: new Date()
                    })
                    .eq('id', existing.id)
                    .select('*')
                    .single();

                if (error) {
                    return res.status(400).json({
                        success: false,
                        data: null,
                        error: ERROR_CODES.SERVER_ERROR,
                        message: error.message
                    });
                }

                // Send confirmation email asynchronously
                emailService.sendBusinessRegistrationEmail(req.user.email, data.name || req.body.name)
                    .catch(err => console.error('Failed to send registration email:', err));

                return res.status(200).json({
                    success: true,
                    data: data,
                    error: null,
                    message: 'Business registration updated successfully'
                });
            }
        }

        // Otherwise insert new business registration
        const { data, error } = await supabase
            .from('businesses')
            .insert({
                user_id: req.user.id,
                ...req.body
            })
            .select('*')
            .single();

        if (error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        // Send confirmation email asynchronously
        emailService.sendBusinessRegistrationEmail(req.user.email, data.name || req.body.name)
            .catch(err => console.error('Failed to send registration email:', err));

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

        const { data: toursData } = await supabase
            .from('tours')
            .select('id')
            .eq('businesses_id', data.id);
        const tourIds = toursData ? toursData.map(tour => tour.id) : [];

        let hotelIds = [];
        try {
            const { data: hotelsData } = await supabase
                .from('hotels')
                .select('id')
                .eq('businesses_id', data.id);
            if (hotelsData) {
                hotelIds = hotelsData.map(hotel => hotel.id);
            }
        } catch (e) {
            console.warn('Hotels query in getMyBusiness failed:', e.message);
        }

        let bookingsCount = 0;
        if (tourIds.length > 0 || hotelIds.length > 0) {
            let query = supabase.from('bookings').select('id');
            if (tourIds.length > 0 && hotelIds.length > 0) {
                query = query.or(`tour_id.in.(${tourIds.join(',')}),hotel_id.in.(${hotelIds.join(',')})`);
            } else if (tourIds.length > 0) {
                query = query.in('tour_id', tourIds);
            } else if (hotelIds.length > 0) {
                query = query.in('hotel_id', hotelIds);
            }
            
            const { data: bookingsData } = await query;
            if (bookingsData) {
                bookingsCount = bookingsData.length;
            }
        }

        let reviewsCount = 0;
        if (tourIds.length > 0) {
            const { count: tourRevCount } = await supabase
                .from('tour_reviews')
                .select('*', { count: 'exact', head: true })
                .in('tour_id', tourIds);
            if (tourRevCount) reviewsCount += tourRevCount;
        }
        if (hotelIds.length > 0) {
            try {
                const { count: hotelRevCount } = await supabase
                    .from('hotel_reviews')
                    .select('*', { count: 'exact', head: true })
                    .in('hotel_id', hotelIds);
                if (hotelRevCount) reviewsCount += hotelRevCount;
            } catch (e) {
                console.warn('Hotel reviews count query failed:', e.message);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                ...data,
                listings: tourIds.length + hotelIds.length,
                bookings: bookingsCount,
                reviews: reviewsCount
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

exports.getMyListings = async (req, res) => {
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
        const { data: tours, error: toursError } = await supabase
            .from('tours')
            .select('*')
            .eq('businesses_id', business.id);

        // 2. Fetch hotels (defensive handling in case businesses_id is not added yet)
        let hotels = [];
        try {
            const { data: hotelsData, error: hotelsError } = await supabase
                .from('hotels')
                .select('*')
                .eq('businesses_id', business.id);
            
            if (!hotelsError && hotelsData) {
                hotels = hotelsData;
            }
        } catch (e) {
            console.warn('Hotels businesses_id query failed (column might not exist yet):', e.message);
        }

        // 3. Map both to a common Listing format
        const listings = [];
        if (tours) {
            tours.forEach(t => {
                listings.push({
                    id: t.id,
                    name: t.name,
                    location: t.destination || t.address || '',
                    price: t.price || 0,
                    status: (t.status || 'pending').toLowerCase(),
                    category: 'tour',
                    created_at: t.created_at
                });
            });
        }
        if (hotels) {
            hotels.forEach(h => {
                listings.push({
                    id: h.id,
                    name: h.name,
                    location: h.address || '',
                    price: h.price_per_night || 0,
                    status: 'active',
                    category: 'hotel',
                    created_at: h.created_at
                });
            });
        }

        res.status(200).json({
            success: true,
            data: listings,
            error: null,
            message: 'Listings retrieved successfully'
        });

    } catch (error) {
        console.error('Get my listings error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};