const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const notifications = require('../services/notification.service');

const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'CHECKED-IN', 'CHECKED-OUT'];

exports.createBooking = async (req, res) => {
    try {
        const bookingData = {
            ...req.body,
            user_id: req.user.id,
            status: 'PENDING',
        };

        // --- OVERBOOKING PREVENTION CHECKS ---
        if (bookingData.tour_id) {
            const requestedGuests = parseInt(bookingData.guests, 10) || 1;
            const bookingDate = bookingData.booking_date || bookingData.check_in;
            if (!bookingDate) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.VALIDATION_ERROR,
                    message: 'Missing booking date'
                });
            }

            // Get tour max participants
            const { data: tour, error: tourError } = await supabase
                .from('tours')
                .select('max_participants')
                .eq('id', bookingData.tour_id)
                .single();

            if (tourError || !tour) {
                return res.status(404).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.NOT_FOUND,
                    message: 'Tour not found'
                });
            }

            const maxParticipants = parseInt(tour.max_participants, 10) || 20;

            // Fetch existing active bookings for this tour on the same day
            const { data: existingBookings, error: fetchError } = await supabase
                .from('bookings')
                .select('guests')
                .eq('tour_id', bookingData.tour_id)
                .or(`booking_date.eq.${bookingDate},check_in.eq.${bookingDate}`)
                .neq('status', 'CANCELLED');

            if (fetchError) {
                throw fetchError;
            }

            const currentBookedSlots = (existingBookings || []).reduce((sum, b) => sum + (parseInt(b.guests, 10) || 1), 0);
            if (currentBookedSlots + requestedGuests > maxParticipants) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.TOUR_OVERBOOKED,
                    message: `Tour is full for this date. Maximum slots: ${maxParticipants}, Booked: ${currentBookedSlots}, Requested: ${requestedGuests}`
                });
            }
        } else if (bookingData.hotel_id) {
            const checkInStr = bookingData.check_in;
            const checkOutStr = bookingData.check_out;
            if (!checkInStr || !checkOutStr) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.VALIDATION_ERROR,
                    message: 'Missing check-in or check-out date'
                });
            }

            const checkInDate = new Date(checkInStr);
            const checkOutDate = new Date(checkOutStr);
            if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.VALIDATION_ERROR,
                    message: 'Invalid check-in or check-out date range'
                });
            }

            // Get hotel total rooms
            const { data: hotel, error: hotelError } = await supabase
                .from('hotels')
                .select('total_rooms')
                .eq('id', bookingData.hotel_id)
                .single();

            if (hotelError || !hotel) {
                return res.status(404).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.NOT_FOUND,
                    message: 'Hotel not found'
                });
            }

            const totalRooms = parseInt(hotel.total_rooms, 10) || 5;

            // Query overlapping active bookings
            const { data: existingBookings, error: fetchError } = await supabase
                .from('bookings')
                .select('check_in, check_out, guests')
                .eq('hotel_id', bookingData.hotel_id)
                .neq('status', 'CANCELLED');

            if (fetchError) {
                throw fetchError;
            }

            // Count occupied rooms per night day-by-day
            const counts = {};
            (existingBookings || []).forEach(b => {
                const bStart = new Date(b.check_in);
                let bEnd = new Date(b.check_out);
                if (isNaN(bStart.getTime())) return;
                if (isNaN(bEnd.getTime()) || bEnd <= bStart) {
                    bEnd = new Date(bStart);
                    bEnd.setDate(bEnd.getDate() + 1);
                }

                // Tally nights occupied by this existing booking
                for (let d = new Date(bStart); d < bEnd; d.setDate(d.getDate() + 1)) {
                    const key = d.toISOString().split('T')[0];
                    counts[key] = (counts[key] || 0) + (parseInt(b.guests, 10) || 1);
                }
            });

            // Check if any night in the requested range exceeds capacity
            for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
                const key = d.toISOString().split('T')[0];
                const occupied = counts[key] || 0;
                if (occupied + 1 > totalRooms) {
                    return res.status(400).json({
                        success: false,
                        data: null,
                        error: ERROR_CODES.HOTEL_OVERBOOKED,
                        message: `Hotel is fully booked on ${key}. Maximum rooms: ${totalRooms}, Occupied: ${occupied}`
                    });
                }
            }
        }
        // -------------------------------------

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

        if (newStatus !== 'CANCELLED') {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Traveler is only allowed to cancel their booking'
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

exports.updateBusinessBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const newStatus = String(req.body.status || '').toUpperCase().replace('_', '-'); // Support CHECKED_IN -> CHECKED-IN

        if (!BOOKING_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: `Invalid booking status. Allowed: ${BOOKING_STATUSES.join(', ')}`
            });
        }

        // 1. Verify user has a business profile
        const { data: business, error: bizError } = await supabase
            .from('businesses')
            .select('id')
            .eq('user_id', req.user.id)
            .single();

        if (bizError || !business) {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.FORBIDDEN,
                message: 'User is not associated with a business profile'
            });
        }

        // 2. Fetch the booking to verify it belongs to this business
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('*, hotels(businesses_id), tours(businesses_id)')
            .eq('id', id)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found'
            });
        }

        const bookingBizId = booking.hotels?.businesses_id || booking.tours?.businesses_id;
        if (bookingBizId !== business.id) {
            return res.status(403).json({
                success: false,
                data: null,
                error: ERROR_CODES.FORBIDDEN,
                message: 'Forbidden: Booking does not belong to your business'
            });
        }

        // 3. Update the booking status
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ status: newStatus })
            .eq('id', id)
            .select()
            .single();

        if (updateError || !updatedBooking) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: 'Failed to update booking status'
            });
        }

        // Notify traveler + business owner of the new status. Best-effort.
        await notifications.notifyBookingStatus(updatedBooking);

        res.status(200).json({
            success: true,
            data: updatedBooking,
            error: null,
            message: 'Booking status updated successfully'
        });

    } catch (error) {
        console.error('Update business booking status error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

// A booking counts as a *completed* trip when it was explicitly marked
// COMPLETED, or it was paid/confirmed (i.e. not pending/cancelled) and its
// check-out date has already passed. Pending (unpaid) and cancelled bookings
// never count — the traveller has not actually taken the trip.
function isTripCompleted(b) {
    if (!b) return false;
    const status = String(b.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'PENDING') return false;
    if (status === 'COMPLETED') return true;

    const end = (() => {
        const raw = b.check_out || b.booking_date || b.check_in;
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw || ''));
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); // local midnight
        return isNaN(d.getTime()) ? null : d;
    })();
    if (!end) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end <= today; // the stay/tour has ended
}

// GET /api/bookings/check?hotelId=… | ?tourId=…
// Tells the client whether the signed-in user has *completed* a stay at the
// given hotel or a trip on the given tour — used to gate review writing
// ("đã hoàn thành hay chưa") and to surface a completed badge.
exports.checkBooking = async (req, res) => {
    try {
        const { hotelId, tourId } = req.query;

        if (!hotelId && !tourId) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.MISSING_PARAMETER,
                message: 'hotelId or tourId query parameter is required'
            });
        }

        const column = hotelId ? 'hotel_id' : 'tour_id';
        const value = hotelId || tourId;

        const { data, error } = await supabase
            .from('bookings')
            .select('id, status, check_in, check_out, booking_date')
            .eq('user_id', req.user.id)
            .eq(column, value)
            .neq('status', 'CANCELLED');

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }

        const isCompleted = (data || []).some(isTripCompleted);

        res.status(200).json({
            success: true,
            data: {
                // hasBooked stays the gate for reviews (kept for backward compat);
                // it is true only once the trip is actually completed.
                hasBooked: isCompleted,
                isCompleted: isCompleted,
                bookingCount: data ? data.length : 0
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

