const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const crypto = require('crypto');

// Tạo transaction_code unique
function generateTransactionCode() {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 ký tự hex
    return `TG${timestamp}${random}`;
}

// Tạo payment (transaction_code hoặc payment_url)
exports.createPayment = async (req, res) => {
    try {
        const { bookingId, amount, paymentMethod } = req.body;
        const userId = req.user.id;

        if (!bookingId || !amount || !paymentMethod) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Missing required fields: bookingId, amount, paymentMethod'
            });
        }

        // Verify booking belongs to user
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, user_id, status')
            .eq('id', bookingId)
            .eq('user_id', userId)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found or unauthorized'
            });
        }

        if (booking.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: `Booking already ${booking.status.toLowerCase()}`
            });
        }

        const transactionCode = generateTransactionCode();

        // Verify uniqueness (retry nếu trùng - cực kỳ hiếm)
        let retries = 0;
        let payment = null;
        let txError = null;

        while (retries < 3) {
            const code = retries === 0 ? transactionCode : generateTransactionCode();

            // Lưu payment vào database (sử dụng bảng payments có sẵn)
            const result = await supabase
                .from('payments')
                .insert([{
                    transaction_code: code,
                    booking_id: bookingId,
                    amount: amount,
                    type: paymentMethod.toUpperCase(),
                    status: 'PENDING',
                    user_id: userId,
                    payment_provider: paymentMethod === 'bank_transfer' ? 'CASSO' : paymentMethod === 'payos' ? 'PAYOS' : null
                }])
                .select()
                .single();

            payment = result.data;
            txError = result.error;

            // Nếu thành công hoặc lỗi không phải duplicate, break
            if (!txError || txError.code !== '23505') {
                break;
            }

            retries++;
            console.log(`[Payment] Transaction code collision, retry ${retries}/3`);
        }

        if (txError) {
            console.error('Payment insert error:', txError);
            return res.status(500).json({
                success: false,
                data: null,
                error: ERROR_CODES.SERVER_ERROR,
                message: 'Failed to create payment'
            });
        }

        // Xử lý theo payment method
        if (paymentMethod === 'bank_transfer') {
            // Trả về thông tin chuyển khoản với transaction_code
            return res.status(200).json({
                success: true,
                data: {
                    payment_method: 'bank_transfer',
                    transaction_code: payment.transaction_code,
                    bank_info: {
                        bank_name: 'BIDV',
                        account_number: 'V3CASS0931215748',
                        account_holder: 'TOURGO PAYMENT',
                        amount: amount,
                        transfer_note: payment.transaction_code
                    }
                },
                error: null,
                message: 'Bank transfer info created'
            });
        } else if (paymentMethod === 'payos') {
            // TODO: Tích hợp PayOS API để tạo payment_url thật
            // Hiện tại trả về mock URL
            const paymentUrl = `https://payos.vn/checkout/${payment.transaction_code}`;

            return res.status(200).json({
                success: true,
                data: {
                    payment_method: 'payos',
                    transaction_code: payment.transaction_code,
                    payment_url: paymentUrl
                },
                error: null,
                message: 'Payment URL created'
            });
        } else if (paymentMethod === 'cod') {
            // COD - không cần thông tin thanh toán
            return res.status(200).json({
                success: true,
                data: {
                    payment_method: 'cod',
                    transaction_code: payment.transaction_code
                },
                error: null,
                message: 'COD payment registered'
            });
        } else {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Invalid payment method'
            });
        }

    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};

// Webhook từ Casso
exports.cassoWebhook = async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('[Casso Webhook] Received:', JSON.stringify(webhookData, null, 2));

        // Verify webhook signature nếu Casso cung cấp
        const cassoApiKey = process.env.CASSO_API_KEY;
        if (!cassoApiKey) {
            console.error('[Casso Webhook] CASSO_API_KEY not configured');
        }

        // Casso webhook format: { data: [...transactions] }
        const transactions = webhookData.data || [];

        for (const tx of transactions) {
            const description = tx.description || tx.when || '';
            const amount = parseFloat(tx.amount) || 0;

            // Extract transaction_code từ description
            // Format: "TG1718956789123456" hoặc có thể có text khác
            const match = description.match(/TG\d{14}/);
            if (!match) {
                console.log('[Casso Webhook] No transaction code found in:', description);
                continue;
            }

            const transactionCode = match[0];
            console.log('[Casso Webhook] Found transaction code:', transactionCode);

            // Tìm transaction trong DB
            const { data: payment, error: txError } = await supabase
                .from('payments')
                .select('*, bookings(id, user_id, status)')
                .eq('transaction_code', transactionCode)
                .eq('status', 'PENDING')
                .single();

            if (txError || !payment) {
                console.log('[Casso Webhook] Payment not found or already processed:', transactionCode);
                continue;
            }

            // Verify amount
            if (Math.abs(amount - payment.amount) > 1000) {
                console.log('[Casso Webhook] Amount mismatch. Expected:', payment.amount, 'Received:', amount);
                continue;
            }

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

            console.log('[Casso Webhook] Payment confirmed for:', transactionCode);
        }

        // Luôn trả về 200 OK cho webhook
        res.status(200).json({ success: true, message: 'Webhook processed' });

    } catch (error) {
        console.error('[Casso Webhook] Error:', error);
        // Vẫn trả về 200 để Casso không retry
        res.status(200).json({ success: true, message: 'Webhook received' });
    }
};

// Update payment status (cho PayOS callback)
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { bookingId, status } = req.body;
        const userId = req.user.id;

        if (!bookingId || !status) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Missing bookingId or status'
            });
        }

        // Verify booking belongs to user
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, user_id')
            .eq('id', bookingId)
            .eq('user_id', userId)
            .single();

        if (bookingError || !booking) {
            return res.status(404).json({
                success: false,
                data: null,
                error: ERROR_CODES.NOT_FOUND,
                message: 'Booking not found or unauthorized'
            });
        }

        // Update booking status
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: status })
            .eq('id', bookingId)
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

        res.status(200).json({
            success: true,
            data: data,
            error: null,
            message: 'Booking status updated'
        });

    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: ERROR_CODES.SERVER_ERROR,
            message: 'Internal server error'
        });
    }
};
