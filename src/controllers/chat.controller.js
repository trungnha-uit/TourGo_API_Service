const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const notifications = require('../services/notification.service');

exports.getOrCreateRoom = async (req, res) => {
    try {
        const { businessId, userId: targetUserId } = req.body;
        let finalUserId = req.user.id;
        let finalBusinessId = businessId;

        // Fetch current user's profile to check if they are a business
        const { data: userProfile } = await supabase
            .from('users')
            .select('role')
            .eq('id', req.user.id)
            .single();

        const isBusiness = userProfile && userProfile.role === 'business';

        if (isBusiness) {
            // Find business id associated with this business owner
            const { data: biz } = await supabase
                .from('businesses')
                .select('id')
                .eq('user_id', req.user.id)
                .single();

            if (biz) {
                finalBusinessId = biz.id;
            }
            if (targetUserId) {
                finalUserId = targetUserId;
            }
        }

        if (!finalBusinessId) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.BAD_REQUEST,
                message: 'businessId is required'
            });
        }

        // 1. Check if room exists
        const { data: existingRoom, error: fetchError } = await supabase
            .from('chat_rooms')
            .select('*, business:businesses(id, name), user:users(id, name, avatar)')
            .eq('user_id', finalUserId)
            .eq('business_id', finalBusinessId)
            .maybeSingle();

        if (fetchError) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: fetchError.message
            });
        }

        if (existingRoom) {
            const formatted = {
                id: existingRoom.id,
                user_id: existingRoom.user_id,
                business_id: existingRoom.business_id,
                created_at: existingRoom.created_at,
                partner_name: isBusiness
                    ? (existingRoom.user ? existingRoom.user.name : 'Khách hàng')
                    : (existingRoom.business ? existingRoom.business.name : 'Doanh nghiệp'),
                partner_avatar: isBusiness
                    ? (existingRoom.user ? existingRoom.user.avatar : null)
                    : null,
                business: existingRoom.business
            };

            return res.status(200).json({
                success: true,
                data: formatted,
                error: null,
                message: 'Chat room retrieved successfully'
            });
        }

        // 2. Create new room
        const { data: newRoom, error: createError } = await supabase
            .from('chat_rooms')
            .insert([{ user_id: finalUserId, business_id: finalBusinessId }])
            .select('*, business:businesses(id, name), user:users(id, name, avatar)')
            .single();

        if (createError) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: createError.message
            });
        }

        const formattedNew = {
            id: newRoom.id,
            user_id: newRoom.user_id,
            business_id: newRoom.business_id,
            created_at: newRoom.created_at,
            partner_name: isBusiness
                ? (newRoom.user ? newRoom.user.name : 'Khách hàng')
                : (newRoom.business ? newRoom.business.name : 'Doanh nghiệp'),
            partner_avatar: isBusiness
                ? (newRoom.user ? newRoom.user.avatar : null)
                : null,
            business: newRoom.business
        };

        res.status(201).json({
            success: true,
            data: formattedNew,
            error: null,
            message: 'Chat room created successfully'
        });
    } catch (error) {
        console.error('getOrCreateRoom error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.getRooms = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch user profile to get the role
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (profileError || !userProfile) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'User profile not found'
            });
        }

        const role = userProfile.role; // 'admin' | 'business' | 'traveler'

        if (role === 'business') {
            // Find business id
            const { data: biz, error: bizError } = await supabase
                .from('businesses')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (bizError || !biz) {
                return res.status(404).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.NOT_FOUND,
                    message: 'Business account not found'
                });
            }

            // Get rooms with traveler (user) info
            // In users table: name, email, avatar
            const { data: rooms, error: roomsError } = await supabase
                .from('chat_rooms')
                .select('*, user:users(id, name, email, avatar)')
                .eq('business_id', biz.id)
                .order('created_at', { ascending: false });

            if (roomsError) {
                return res.status(500).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.SERVER_ERROR,
                    message: roomsError.message
                });
            }

            // Map keys for easy client parsing
            const formattedRooms = (rooms || []).map(r => ({
                id: r.id,
                user_id: r.user_id,
                business_id: r.business_id,
                created_at: r.created_at,
                partner_name: r.user ? r.user.name : 'Khách hàng',
                partner_avatar: r.user ? r.user.avatar : null
            }));

            return res.status(200).json({
                success: true,
                data: formattedRooms,
                error: null,
                message: 'Business chat rooms retrieved successfully'
            });
        } else {
            // Traveler
            const { data: rooms, error: roomsError } = await supabase
                .from('chat_rooms')
                .select('*, business:businesses(id, name)')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (roomsError) {
                return res.status(500).json({
                    success: false,
                    data: null,
                    error: ERROR_CODES.SERVER_ERROR,
                    message: roomsError.message
                });
            }

            const formattedRooms = (rooms || []).map(r => ({
                id: r.id,
                user_id: r.user_id,
                business_id: r.business_id,
                created_at: r.created_at,
                partner_name: r.business ? r.business.name : 'Doanh nghiệp',
                partner_avatar: null
            }));

            return res.status(200).json({
                success: true,
                data: formattedRooms,
                error: null,
                message: 'Traveler chat rooms retrieved successfully'
            });
        }
    } catch (error) {
        console.error('getRooms error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;

        const { data: messages, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('room_id', roomId)
            .order('created_at', { ascending: true });

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
            data: messages,
            error: null,
            message: 'Messages retrieved successfully'
        });
    } catch (error) {
        console.error('getMessages error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { messageText } = req.body;
        const senderId = req.user.id;

        if (!messageText || messageText.trim() === '') {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.BAD_REQUEST,
                message: 'messageText is required'
            });
        }

        const { data: message, error } = await supabase
            .from('chat_messages')
            .insert([{
                room_id: roomId,
                sender_id: senderId,
                message_text: messageText.trim()
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: error.message
            });
        }
        // Notify the recipient (business owner / traveler). Best-effort.
        await notifications.notifyChatMessage(message);

        res.status(201).json({
            success: true,
            data: message,
            error: null,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('sendMessage error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};

exports.sendImageMessage = async (req, res) => {
    try {
        const { roomId } = req.params;
        const senderId = req.user.id;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.BAD_REQUEST,
                message: 'Image file is required'
            });
        }

        const file = req.file;
        const fileExt = file.mimetype.split('/')[1] || 'jpg';
        const fileName = `chats/${roomId}/${Date.now()}.${fileExt}`;

        // Upload to the existing 'review-images' bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('review-images')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase chat upload error:', uploadError);
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

        // Create message entry in DB
        const { data: message, error: dbError } = await supabase
            .from('chat_messages')
            .insert([{
                room_id: roomId,
                sender_id: senderId,
                message_text: '[Hình ảnh]',
                image_url: publicUrl
            }])
            .select()
            .single();

        if (dbError) {
            console.error('Save chat image message error:', dbError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: dbError.message
            });
        }
        // Notify the recipient (business owner / traveler). Best-effort.
        await notifications.notifyChatMessage(message);

        res.status(201).json({
            success: true,
            data: message,
            error: null,
            message: 'Image message sent successfully'
        });
    } catch (error) {
        console.error('sendImageMessage error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: error.message
        });
    }
};
