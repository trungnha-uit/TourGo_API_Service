const router = require('express').Router();
const paymentController = require('../controllers/payment.controller');
const auth = require('../middleware/auth');

// Tạo payment (transaction_code cho bank_transfer hoặc payment_url cho payos)
router.post('/create', auth, paymentController.createPayment);

// Webhook từ Casso khi nhận được tiền chuyển khoản
router.post('/webhook/casso', paymentController.cassoWebhook);

// Update booking status sau khi thanh toán thành công (cho PayOS callback)
router.patch('/update-status', auth, paymentController.updatePaymentStatus);

module.exports = router;
