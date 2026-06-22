const supabase = require('../config/supabase');
const ERROR_CODES = require('../constants/errorCodes');
const crypto = require('crypto');

// Tạo transaction_code unique
function generateTransactionCode() {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 ký tự hex
    return `TG${timestamp}${random}`;
}

function mapPaymentType(paymentMethod) {
    switch (paymentMethod) {
        case 'bank_transfer':
            return 'BANK_TRANSFER';
        case 'cod':
            return 'CASH';
        case 'vietqr':
            return 'VIETQR';
        case 'momo':
            return 'MOMO';
        case 'vnpay':
            return 'VNPAY';
        case 'zalopay':
            return 'ZALOPAY';
        default:
            return null;
    }
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

        // Verify booking belongs to user và lấy thông tin để tính toán
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select(`
                id,
                user_id,
                status,
                check_in,
                check_out,
                hotel_id,
                tour_id,
                hotels(price_per_night),
                tours(price)
            `)
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

        // Tính lại số tiền từ booking (backend là source of truth)
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const nights = Math.ceil((checkOut - checkIn) / (24 * 60 * 60 * 1000));

        const pricePerNight = booking.hotel_id
            ? (booking.hotels?.price_per_night || 0)
            : (booking.tours?.price || 0);

        const roomPrice = pricePerNight * nights;
        const taxRate = parseFloat(process.env.TAX_RATE || '0.1');
        const taxes = roomPrice * taxRate;
        const serviceCharge = parseFloat(process.env.SERVICE_CHARGE || '50000');
        const calculatedAmount = roomPrice + taxes + serviceCharge;

        // Verify amount từ client (tolerance từ env)
        const tolerance = parseFloat(process.env.AMOUNT_TOLERANCE || '1000');
        if (Math.abs(amount - calculatedAmount) > tolerance) {
            console.warn(`[Payment] Amount mismatch. Client: ${amount}, Calculated: ${calculatedAmount}`);
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: `Invalid amount. Expected: ${calculatedAmount}`
            });
        }

        // Dùng số tiền tính toán từ backend
        const finalAmount = calculatedAmount;

        const paymentType = mapPaymentType(paymentMethod);
        if (!paymentType) {
            return res.status(400).json({
                success: false,
                data: null,
                error: ERROR_CODES.VALIDATION_ERROR,
                message: 'Invalid payment method'
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
                    amount: finalAmount, // Dùng số tiền backend tính
                    type: paymentType,
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
                        bank_name: process.env.BANK_NAME || 'BIDV',
                        account_number: process.env.BANK_ACCOUNT_NUMBER || 'V3CASS0931215748',
                        account_holder: process.env.BANK_ACCOUNT_HOLDER || 'TOURGO PAYMENT',
                        amount: finalAmount, // Số tiền backend tính
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
            // Format: "TG{timestamp}{6-hex}" VD: TG1719056789ABCD12
            const match = description.match(/TG\d{13}[A-F0-9]{6}/i);
            if (!match) {
                console.log('[Casso Webhook] No transaction code found in:', description);
                continue;
            }

            const transactionCode = match[0];
            console.log('[Casso Webhook] Found transaction code:', transactionCode);

            // Tìm transaction trong DB với business info
            const { data: payment, error: txError } = await supabase
                .from('payments')
                .select(`
                    *,
                    bookings(
                        id,
                        user_id,
                        status,
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
                console.log('[Casso Webhook] Payment not found or already processed:', transactionCode);
                continue;
            }

            // Verify amount
            if (Math.abs(amount - payment.amount) > 1000) {
                console.log('[Casso Webhook] Amount mismatch. Expected:', payment.amount, 'Received:', amount);
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

            const commissionRate = businessInfo?.commission_rate || parseFloat(process.env.DEFAULT_COMMISSION_RATE) || 0.15;

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

            console.log(`[Casso Webhook] Payment confirmed: ${transactionCode}, Platform ${platformCommission}, Business ${businessAmount}`);
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
