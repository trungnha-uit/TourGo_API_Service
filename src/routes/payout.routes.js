const express = require('express');
const router = express.Router();
const payoutController = require('../controllers/payout.controller');
const auth = require('../middleware/auth');

// Tạo payout cho business (admin/cronjob)
router.post('/create', auth, payoutController.createBusinessPayout);

// Confirm payout đã chuyển tiền (admin)
router.post('/confirm', auth, payoutController.confirmBusinessPayout);

module.exports = router;
