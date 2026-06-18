const router = require('express').Router();
const hotelController = require('../controllers/hotel.controller');
const auth = require('../middleware/auth');
const businessesAuth = require('../middleware/businessesAuth');

router.get('/', hotelController.getAllHotels);
router.get('/search', hotelController.searchHotels);
router.get('/:id', hotelController.getHotelById);

router.post('/', auth, businessesAuth, hotelController.createHotel);

module.exports = router;