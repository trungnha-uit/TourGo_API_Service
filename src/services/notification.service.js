const supabase = require('../config/supabase');

/**
 * Notifications are best-effort: they must never break the action that triggered
 * them (creating a booking, leaving a review, ...). Every helper here swallows
 * its own errors. If the `notifications` table hasn't been migrated yet
 * (Postgres error 42P01) we stay silent so the app keeps working pre-migration.
 */

/** Low-level insert. Idempotent via the UNIQUE source_key (ON CONFLICT DO NOTHING). */
async function createNotification({ userId, role, category, title, body, icon, sourceKey, data }) {
    if (!userId || !role || !title) return;
    try {
        const { error } = await supabase
            .from('notifications')
            .upsert(
                [{
                    user_id: userId,
                    role,
                    category,
                    title,
                    body: body || null,
                    icon: icon || null,
                    source_key: sourceKey || null,
                    data: data || null,
                }],
                { onConflict: 'source_key', ignoreDuplicates: true }
            );
        if (error && error.code !== '42P01') {
            console.warn('createNotification failed:', error.message);
        }
    } catch (e) {
        console.warn('createNotification exception:', e.message);
    }
}

/** Resolve the owning business user + listing name for a tour or hotel. */
async function resolveListingOwner({ tourId, hotelId }) {
    try {
        const table = tourId ? 'tours' : (hotelId ? 'hotels' : null);
        const id = tourId || hotelId;
        if (!table || !id) return { ownerUserId: null, listingName: null };

        const { data: listing } = await supabase
            .from(table)
            .select('name, businesses_id')
            .eq('id', id)
            .single();
        if (!listing) return { ownerUserId: null, listingName: null };

        let ownerUserId = null;
        if (listing.businesses_id) {
            const { data: biz } = await supabase
                .from('businesses')
                .select('user_id')
                .eq('id', listing.businesses_id)
                .single();
            ownerUserId = biz ? biz.user_id : null;
        }
        return { ownerUserId, listingName: listing.name };
    } catch (e) {
        console.warn('resolveListingOwner failed:', e.message);
        return { ownerUserId: null, listingName: null };
    }
}

// Status -> notification content. Kept in sync with migrations/notifications.sql.
function travelerContent(status, listingName) {
    const map = {
        PENDING:   { category: 'bookings', icon: 'calendar',       title: 'Đặt chỗ đang chờ xác nhận' },
        CONFIRMED: { category: 'bookings', icon: 'check_circle',   title: 'Đặt chỗ đã được xác nhận' },
        COMPLETED: { category: 'payments', icon: 'dollar',         title: 'Thanh toán thành công' },
        CANCELLED: { category: 'bookings', icon: 'alert_triangle', title: 'Đặt chỗ đã hủy' },
    };
    const c = map[status] || { category: 'bookings', icon: 'calendar', title: 'Cập nhật đặt chỗ' };
    return { ...c, body: listingName || 'Chuyến đi của bạn' };
}

function businessContent(status, listingName) {
    const map = {
        PENDING:   { category: 'orders', icon: 'calendar',       title: 'Đơn đặt mới' },
        CONFIRMED: { category: 'orders', icon: 'check_circle',   title: 'Đơn đã được xác nhận' },
        COMPLETED: { category: 'orders', icon: 'dollar',         title: 'Đơn đã hoàn tất' },
        CANCELLED: { category: 'orders', icon: 'alert_triangle', title: 'Đơn đã bị hủy' },
    };
    const c = map[status] || { category: 'orders', icon: 'calendar', title: 'Cập nhật đơn đặt' };
    return { ...c, body: listingName || 'Một mục của bạn' };
}

/**
 * Fan-out for a booking at a given status: notify the traveler (their booking)
 * and the business owner (an order on their listing).
 */
async function notifyBookingStatus(booking) {
    try {
        if (!booking || !booking.id) return;
        const status = (booking.status || 'PENDING').toUpperCase();
        const { ownerUserId, listingName } = await resolveListingOwner({
            tourId: booking.tour_id,
            hotelId: booking.hotel_id,
        });

        // Traveler
        if (booking.user_id) {
            const c = travelerContent(status, listingName);
            await createNotification({
                userId: booking.user_id,
                role: 'TRAVELER',
                category: c.category,
                title: c.title,
                body: c.body,
                icon: c.icon,
                sourceKey: `booking:${booking.id}:traveler:${status.toLowerCase()}`,
                data: { booking_id: booking.id, status },
            });
        }

        // Business owner (skip if the owner is also the traveler on their own booking)
        if (ownerUserId && ownerUserId !== booking.user_id) {
            const c = businessContent(status, listingName);
            await createNotification({
                userId: ownerUserId,
                role: 'BUSINESS',
                category: c.category,
                title: c.title,
                body: c.body,
                icon: c.icon,
                sourceKey: `booking:${booking.id}:business:${status.toLowerCase()}`,
                data: { booking_id: booking.id, status },
            });
        }
    } catch (e) {
        console.warn('notifyBookingStatus failed:', e.message);
    }
}

/** Notify the business owner that a new review landed on their listing. */
async function notifyReviewCreated(review, type) {
    try {
        if (!review || !review.id) return;
        const tourId = type === 'tour' ? (review.tour_id) : null;
        const hotelId = type === 'hotel' ? (review.hotel_id) : null;
        const { ownerUserId, listingName } = await resolveListingOwner({ tourId, hotelId });
        if (!ownerUserId) return;

        const stars = review.stars != null ? review.stars : '';
        await createNotification({
            userId: ownerUserId,
            role: 'BUSINESS',
            category: 'support',
            title: `Đánh giá mới (${stars}★)`,
            body: (review.review_text && review.review_text.trim()) || listingName || 'Đánh giá khách hàng',
            icon: 'star',
            sourceKey: `review:${type}:${review.id}`,
            data: { review_id: review.id, type },
        });
    } catch (e) {
        console.warn('notifyReviewCreated failed:', e.message);
    }
}

module.exports = {
    createNotification,
    resolveListingOwner,
    notifyBookingStatus,
    notifyReviewCreated,
};
