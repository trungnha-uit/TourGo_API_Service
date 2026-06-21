const router = require('express').Router();
const hotelController = require('../controllers/hotel.controller');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const businessesAuth = require('../middleware/businessesAuth');

router.get('/', hotelController.getAllHotels);
router.get('/search', hotelController.searchHotels);
router.get('/pending', auth, adminOnly, hotelController.getPendingHotels);
router.get('/:id', hotelController.getHotelById);

router.post('/', auth, businessesAuth, hotelController.createHotel);

router.put('/:id/approve', auth, adminOnly, hotelController.approveHotel);
router.put('/:id/reject', auth, adminOnly, hotelController.rejectHotel);

module.exports = router;