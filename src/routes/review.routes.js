const router = require('express').Router();
const reviewController = require('../controllers/review.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', reviewController.getReviews);
router.get('/business', auth, reviewController.getBusinessReviews);
router.post('/', auth, reviewController.createReview);
router.patch('/:id', auth, reviewController.updateReview);
router.delete('/:id', auth, reviewController.deleteReview);
router.post('/:reviewId/images', auth, upload.single('image'), reviewController.uploadReviewImage);
router.post('/images', auth, reviewController.saveReviewImages);

module.exports = router;
