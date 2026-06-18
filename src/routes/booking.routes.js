const router = require('express').Router();
const bookingController = require('../controllers/booking.controller');
const auth = require('../middleware/auth');

router.post('/', auth, bookingController.createBooking);
router.get('/', auth, bookingController.getMyBookings);
router.get('/check', auth, bookingController.checkBooking);
router.get('/business', auth, bookingController.getBusinessBookings);
router.get('/:id', auth, bookingController.getBookingById);
router.patch('/:id/cancel', auth, bookingController.cancelBooking);

module.exports = router;