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

/**
 * Notify the recipient of a new chat message. A room links a traveler
 * (chat_rooms.user_id) to a business (chat_rooms.business_id): if the traveler
 * sent it, the business owner is notified (role BUSINESS, "support" category);
 * if the business replied, the traveler is notified (role TRAVELER). Keyed by
 * message id so each message produces exactly one row per recipient.
 */
async function notifyChatMessage(message) {
    try {
        if (!message || !message.id || !message.room_id) return;

        const { data: room } = await supabase
            .from('chat_rooms')
            .select('id, user_id, business_id')
            .eq('id', message.room_id)
            .single();
        if (!room) return;

        const raw = message.image_url ? '[Hình ảnh]' : (message.message_text || '').trim();
        const preview = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
        const senderIsTraveler = message.sender_id === room.user_id;

        // Resolve the owning business (owner user_id + display name).
        let ownerUserId = null;
        let businessName = null;
        if (room.business_id) {
            const { data: biz } = await supabase
                .from('businesses')
                .select('user_id, name')
                .eq('id', room.business_id)
                .single();
            ownerUserId = biz ? biz.user_id : null;
            businessName = biz ? biz.name : null;
        }

        if (senderIsTraveler) {
            // Traveler -> business owner.
            if (!ownerUserId) return;
            let travelerName = null;
            if (room.user_id) {
                const { data: u } = await supabase
                    .from('users').select('name').eq('id', room.user_id).single();
                travelerName = u ? u.name : null;
            }
            await createNotification({
                userId: ownerUserId,
                role: 'BUSINESS',
                category: 'support',
                title: 'Tin nhắn mới',
                body: travelerName ? `${travelerName}: ${preview}` : preview,
                icon: 'reply',
                sourceKey: `chat:msg:${message.id}:business`,
                data: { room_id: room.id, message_id: message.id, type: 'chat' },
            });
        } else {
            // Business -> traveler.
            if (!room.user_id) return;
            await createNotification({
                userId: room.user_id,
                role: 'TRAVELER',
                category: 'bookings',
                title: 'Tin nhắn mới',
                body: businessName ? `${businessName}: ${preview}` : preview,
                icon: 'reply',
                sourceKey: `chat:msg:${message.id}:traveler`,
                data: { room_id: room.id, message_id: message.id, type: 'chat' },
            });
        }
    } catch (e) {
        console.warn('notifyChatMessage failed:', e.message);
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

/**
 * Notify every admin that a business registration is awaiting approval. Fans out
 * one row per admin (source_key is globally unique, so the admin id is part of the
 * key). The submission timestamp is included too, so a re-application after a
 * rejection produces a fresh notification rather than colliding with the old one.
 */
async function notifyAdminsBusinessPending(business) {
    try {
        if (!business || !business.id) return;

        const { data: admins, error } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin');
        if (error || !admins || admins.length === 0) return;

        const bizName = business.name || 'Doanh nghiệp mới';
        const submittedAt = business.created_at || '';
        for (const admin of admins) {
            await createNotification({
                userId: admin.id,
                role: 'ADMIN',
                category: 'approvals',
                title: 'Doanh nghiệp mới chờ duyệt',
                body: bizName,
                icon: 'shield_check',
                sourceKey: `business:${business.id}:pending:${submittedAt}:${admin.id}`,
                data: { business_id: business.id },
            });
        }
    } catch (e) {
        console.warn('notifyAdminsBusinessPending failed:', e.message);
    }
}

async function notifyListingApprovalStatus(listing, type, status, note = '') {
    try {
        if (!listing || !listing.id) return;
        
        // Find business owner's user_id
        let ownerUserId = null;
        if (listing.businesses_id) {
            const { data: biz } = await supabase
                .from('businesses')
                .select('user_id')
                .eq('id', listing.businesses_id)
                .single();
            ownerUserId = biz ? biz.user_id : null;
        }
        
        if (!ownerUserId) return;

        let title = '';
        let body = '';
        let icon = '';

        const typeLabel = type === 'tour' ? 'Tour' : 'Khách sạn';

        if (status === 'APPROVED') {
            title = 'Bài đăng đã được duyệt';
            body = `${typeLabel} "${listing.name}" của bạn đã được phê duyệt thành công.`;
            icon = 'check_circle';
        } else if (status === 'REJECTED') {
            title = 'Bài đăng bị từ chối';
            body = `${typeLabel} "${listing.name}" của bạn đã bị từ chối phê duyệt. ${note ? 'Lý do: ' + note : ''}`;
            icon = 'x_circle';
        } else if (status === 'REVISION') {
            title = 'Yêu cầu chỉnh sửa bài đăng';
            body = `${typeLabel} "${listing.name}" cần chỉnh sửa lại theo yêu cầu. ${note ? 'Ghi chú: ' + note : ''}`;
            icon = 'edit_3';
        } else {
            return;
        }

        await createNotification({
            userId: ownerUserId,
            role: 'BUSINESS',
            category: 'support',
            title,
            body,
            icon,
            sourceKey: `listing:${type}:${listing.id}:${status.toLowerCase()}:${Date.now()}`,
            data: { listing_id: listing.id, type, status },
        });
    } catch (e) {
        console.warn('notifyListingApprovalStatus failed:', e.message);
    }
}

module.exports = {
    createNotification,
    resolveListingOwner,
    notifyBookingStatus,
    notifyChatMessage,
    notifyReviewCreated,
    notifyAdminsBusinessPending,
    notifyListingApprovalStatus,
};
