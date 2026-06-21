const supabase = require('../config/supabase');

// Khi Casso webhook nhận được tiền
exports.cassoWebhook = async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('[Casso Webhook] Received:', JSON.stringify(webhookData, null, 2));

        const transactions = webhookData.data || [];

        for (const tx of transactions) {
            const description = tx.description || tx.when || '';
            const amount = parseFloat(tx.amount) || 0;

            const match = description.match(/TG\d{13}[A-F0-9]{6}/i);
            if (!match) {
                console.log('[Casso Webhook] No transaction code found in:', description);
                continue;
            }

            const transactionCode = match[0];

            // Tìm payment
            const { data: payment, error: txError } = await supabase
                .from('payments')
                .select(`
                    *,
                    bookings(
                        id,
                        hotel_id,
                        tour_id,
                        hotels(businesses_id, businesses(commission_rate)),
                        tours(businesses_id, businesses(commission_rate))
                    )
                `)
                .eq('transaction_code', transactionCode)
                .eq('status', 'PENDING')
                .single();

            if (txError || !payment) {
                console.log('[Casso Webhook] Payment not found:', transactionCode);
                continue;
            }

            // Verify amount
            if (Math.abs(amount - payment.amount) > 1000) {
                console.log('[Casso Webhook] Amount mismatch');
                continue;
            }

            // Lấy business_id và commission_rate
            const booking = payment.bookings;
            const businessInfo = booking.hotel_id
                ? booking.hotels?.businesses
                : booking.tours?.businesses;

            const businessId = booking.hotel_id
                ? booking.hotels?.businesses_id
                : booking.tours?.businesses_id;

            const commissionRate = businessInfo?.commission_rate || 0.15; // Default 15%

            // Tính toán chia tiền
            const platformCommission = payment.amount * commissionRate;
            const businessAmount = payment.amount - platformCommission;

            // Update payment status
            await supabase
                .from('payments')
                .update({
                    status: 'PAID',
                    paid_at: new Date().toISOString(),
                    metadata: { casso_transaction_id: tx.id }
                })
                .eq('transaction_code', transactionCode);

            // Update booking status
            await supabase
                .from('bookings')
                .update({ status: 'PAID' })
                .eq('id', payment.booking_id);

            // Tạo payment_split
            await supabase
                .from('payment_splits')
                .insert([{
                    payment_id: payment.id,
                    booking_id: payment.booking_id,
                    business_id: businessId,
                    total_amount: payment.amount,
                    platform_commission_rate: commissionRate,
                    platform_commission: platformCommission,
                    business_amount: businessAmount,
                    status: 'PLATFORM_RECEIVED',
                    platform_received_at: new Date().toISOString()
                }]);

            console.log(`[Casso Webhook] Payment split created: Platform ${platformCommission}, Business ${businessAmount}`);
        }

        res.status(200).json({ success: true, message: 'Webhook processed' });

    } catch (error) {
        console.error('[Casso Webhook] Error:', error);
        res.status(200).json({ success: true, message: 'Webhook received' });
    }
};

// API trigger payout cho business (chạy manual hoặc cronjob)
exports.createBusinessPayout = async (req, res) => {
    try {
        const { businessId } = req.body;

        // Lấy tất cả payment_splits chưa trả cho business này
        const { data: splits, error } = await supabase
            .from('payment_splits')
            .select('*, businesses(bank_name, bank_account_number, bank_account_holder)')
            .eq('business_id', businessId)
            .eq('status', 'PLATFORM_RECEIVED');

        if (error || !splits || splits.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No pending splits found'
            });
        }

        // Tính tổng tiền cần trả
        const totalAmount = splits.reduce((sum, s) => sum + parseFloat(s.business_amount), 0);
        const business = splits[0].businesses;

        if (!business.bank_account_number) {
            return res.status(400).json({
                success: false,
                message: 'Business bank info not configured'
            });
        }

        // Tạo business_payout
        const { data: payout, error: payoutError } = await supabase
            .from('business_payouts')
            .insert([{
                business_id: businessId,
                amount: totalAmount,
                bank_name: business.bank_name,
                account_number: business.bank_account_number,
                account_holder: business.bank_account_holder,
                payment_split_ids: splits.map(s => s.id),
                status: 'PENDING'
            }])
            .select()
            .single();

        if (payoutError) {
            return res.status(500).json({
                success: false,
                message: payoutError.message
            });
        }

        // TODO: Tích hợp API chuyển khoản tự động (VietQR, Banking API)
        // Hoặc admin chuyển thủ công rồi update status

        res.status(200).json({
            success: true,
            data: {
                payout_id: payout.id,
                amount: totalAmount,
                recipient: business.bank_account_holder,
                account_number: business.bank_account_number,
                message: 'Payout created. Please process bank transfer manually.'
            }
        });

    } catch (error) {
        console.error('Create payout error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// API confirm payout đã chuyển tiền (admin gọi sau khi chuyển thành công)
exports.confirmBusinessPayout = async (req, res) => {
    try {
        const { payoutId, transactionId } = req.body;

        // Update payout status
        const { data: payout, error } = await supabase
            .from('business_payouts')
            .update({
                status: 'SUCCESS',
                transaction_id: transactionId,
                processed_at: new Date().toISOString()
            })
            .eq('id', payoutId)
            .select()
            .single();

        if (error || !payout) {
            return res.status(404).json({
                success: false,
                message: 'Payout not found'
            });
        }

        // Update tất cả payment_splits liên quan
        await supabase
            .from('payment_splits')
            .update({
                status: 'BUSINESS_PAID',
                business_paid_at: new Date().toISOString()
            })
            .in('id', payout.payment_split_ids);

        res.status(200).json({
            success: true,
            message: 'Payout confirmed successfully'
        });

    } catch (error) {
        console.error('Confirm payout error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
