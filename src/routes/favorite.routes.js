const router = require('express').Router();
const favoriteController = require('../controllers/favorite.controller');
const auth = require('../middleware/auth');

router.get('/', auth, favoriteController.getUserFavorites);
router.post('/', auth, favoriteController.addFavorite);
router.delete('/:id', auth, favoriteController.removeFavorite);

module.exports = router;