const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const notifications = require('../services/notification.service');

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

exports.createBooking = async (req, res) => {
    try {
        const bookingData = {
            ...req.body,
            user_id: req.user.id,
            status: 'PENDING',
        };

        const { data, error } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();

        if (error) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.BOOKING_ERROR,
                message: error.message
            });
        }

        // Fan-out notifications (traveler + business owner). Best-effort.
        await notifications.notifyBookingStatus(data);

        res.status(201).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking created successfully'
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getMyBookings = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', req.user.id)
            .order('booking_date', { ascending: false });

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
            message: 'Bookings retrieved successfully'
        });

    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking retrieved successfully'
        });

    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('bookings')
            .update({ status: 'CANCELLED' })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found'
            });
        }

        // Notify traveler + business owner of the cancellation. Best-effort.
        await notifications.notifyBookingStatus(data);

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const newStatus = String(req.body.status || '').toUpperCase();

        if (!BOOKING_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: `Invalid booking status. Allowed: ${BOOKING_STATUSES.join(', ')}`
            });
        }

        const { data, error } = await supabase
            .from('bookings')
            .update({ status: newStatus })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found'
            });
        }

        // Notify traveler + business owner of the new status. Best-effort.
        await notifications.notifyBookingStatus(data);

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking status updated successfully'
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.checkBooking = async (req, res) => {
    try {
        const { hotelId } = req.query;

        const { data, error } = await supabase
            .from('bookings')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('hotel_id', hotelId)
            .eq('status', 'COMPLETED')
            .limit(1);

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
            data: {
                hasBooked: data && data.length > 0
            },
            error: null,
            message: 'Check completed successfully'
        });

    } catch (error) {
        console.error('Check booking error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

exports.getBusinessBookings = async (req, res) => {
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
            .select('id')
            .eq('businesses_id', business.id);
        const tourIds = tours ? tours.map(t => t.id) : [];

        // 2. Fetch hotels (defensive)
        let hotelIds = [];
        try {
            const { data: hotels } = await supabase
                .from('hotels')
                .select('id')
                .eq('businesses_id', business.id);
            if (hotels) hotelIds = hotels.map(h => h.id);
        } catch (e) {
            console.warn('Hotels query in getBusinessBookings failed:', e.message);
        }

        if (tourIds.length === 0 && hotelIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                error: null,
                message: 'No bookings found'
            });
        }

        // 3. Query bookings
        let query = supabase.from('bookings').select('*');
        if (tourIds.length > 0 && hotelIds.length > 0) {
            query = query.or(`tour_id.in.(${tourIds.join(',')}),hotel_id.in.(${hotelIds.join(',')})`);
        } else if (tourIds.length > 0) {
            query = query.in('tour_id', tourIds);
        } else if (hotelIds.length > 0) {
            query = query.in('hotel_id', hotelIds);
        }

        const { data: bookings, error } = await query
            .select('*, users(name, phone), hotels(name), tours(name)')
            .order('booking_date', { ascending: false });

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
            data: bookings || [],
            error: null,
            message: 'Bookings retrieved successfully'
        });

    } catch (error) {
        console.error('Get business bookings error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Missing status'
            });
        }

        const { data, error } = await supabase
            .from('bookings')
            .update({ status: status.toUpperCase() })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found or unauthorized'
            });
        }

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking status updated successfully'
        });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
