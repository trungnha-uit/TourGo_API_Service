const router = require('express').Router();
const tourController = require('../controllers/tour.controller');

router.get('/', tourController.getAllTours);
router.get('/search', tourController.searchTours);
router.get('/:id', tourController.getTourById);

module.exports = router;