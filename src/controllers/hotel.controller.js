const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const notificationService = require('../services/notification.service');

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
            status: 'PENDING',
            total_rooms: parseInt(req.body.total_rooms, 10) || 1
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

        const { data, error } = await supabase
            .from('hotels')
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
            notificationService.notifyListingApprovalStatus(data[0], 'hotel', 'APPROVED');
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

        const { data, error } = await supabase
            .from('hotels')
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
            notificationService.notifyListingApprovalStatus(data[0], 'hotel', 'REJECTED');
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

// ── Sold-out / unavailable nights for a hotel ───────────────────────────────
// A night is "sold out" (hết phòng) when the number of active (non-cancelled)
// bookings covering it reaches the hotel's room capacity. Hotels may declare
// capacity via a `total_rooms` column; when it is absent we treat the hotel as
// a single bookable unit so any booked night becomes unavailable.
const DEFAULT_TOTAL_ROOMS = 1;

// Parse a 'YYYY-MM-DD' (or longer ISO) string into a local midnight Date.
// Returns null when the value is missing or malformed.
function parseDateOnly(value) {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
}

// Format a Date back to a 'YYYY-MM-DD' key.
function toDateKey(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

exports.getUnavailableDates = async (req, res) => {
    try {
        const { id } = req.params;

        // Window defaults to today → today + 180 days; override via ?from & ?to.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const from = parseDateOnly(req.query.from) || today;
        let to = parseDateOnly(req.query.to);
        if (!to) {
            to = new Date(from);
            to.setDate(to.getDate() + 180);
        }

        // Look up the hotel (and its optional capacity).
        const { data: hotel, error: hotelError } = await supabase
            .from('hotels')
            .select('*')
            .eq('id', id)
            .single();

        if (hotelError || !hotel) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Hotel not found'
            });
        }

        const parsedRooms = parseInt(hotel.total_rooms, 10);
        const totalRooms = parsedRooms > 0 ? parsedRooms : DEFAULT_TOTAL_ROOMS;

        // Cancelled bookings free their rooms, so they are excluded.
        const { data: bookings, error: bookingsError } = await supabase
            .from('bookings')
            .select('check_in, check_out, booking_date, status')
            .eq('hotel_id', id)
            .neq('status', 'CANCELLED');

        if (bookingsError) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: bookingsError.message
            });
        }

        // Tally how many bookings occupy each night within the window. A stay
        // runs from check-in (inclusive) to check-out (exclusive).
        const counts = {};
        (bookings || []).forEach(b => {
            const start = parseDateOnly(b.check_in || b.booking_date);
            if (!start) return;
            let end = parseDateOnly(b.check_out);
            if (!end || end <= start) {
                end = new Date(start);
                end.setDate(end.getDate() + 1); // assume a single-night stay
            }
            for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
                if (d < from || d > to) continue;
                const key = toDateKey(d);
                counts[key] = (counts[key] || 0) + 1;
            }
        });

        const unavailableDates = Object.keys(counts)
            .filter(key => counts[key] >= totalRooms)
            .sort();

        res.status(200).json({
            success: true,
            data: {
                hotel_id: id,
                total_rooms: totalRooms,
                from: toDateKey(from),
                to: toDateKey(to),
                unavailable_dates: unavailableDates,
                counts
            },
            error: null,
            message: 'Unavailable dates retrieved successfully'
        });
    } catch (error) {
        console.error('Get unavailable dates error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
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
            message: 'Internal server error'
        });
    }
};
