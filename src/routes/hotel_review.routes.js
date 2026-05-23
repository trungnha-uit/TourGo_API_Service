const router = require('express').Router();
const hotelReviewController = require('../controllers/hotel_review.controller');
const auth = require('../middleware/auth');

router.get('/', hotelReviewController.getReviewsByHotelId);
router.post('/', auth, hotelReviewController.createHotelReview);
router.patch('/:id', auth, hotelReviewController.updateHotelReview);
router.delete('/:id', auth, hotelReviewController.deleteHotelReview);
router.post('/:reviewId/images', auth, hotelReviewController.uploadReviewImage);
router.post('/images', auth, hotelReviewController.saveReviewImages);

module.exports = router;