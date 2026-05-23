const router = require('express').Router();
const hotelController = require('../controllers/hotel.controller');

router.get('/', hotelController.getAllHotels);
router.get('/search', hotelController.searchHotels);
router.get('/:id', hotelController.getHotelById);

module.exports = router;