const router = require('express').Router();
const tourController = require('../controllers/tour.controller');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const businessesAuth = require('../middleware/businessesAuth');
const upload = require('../middleware/upload');

router.get('/', tourController.getAllTours);
router.get('/search', tourController.searchTours);
router.get('/pending', auth, adminOnly, tourController.getPendingTours);
router.get('/:id', tourController.getTourById);

router.post('/', auth, businessesAuth, tourController.createTour);
router.post('/:id/images', auth, businessesAuth, upload.single('image'), tourController.uploadTourImages);

router.put('/:id/approve', auth, adminOnly, tourController.approveTour);
router.put('/:id/reject', auth, adminOnly, tourController.rejectTour);

module.exports = router;