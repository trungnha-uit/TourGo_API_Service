const router = require('express').Router();
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.get('/', auth, adminOnly, userController.getAllUsers);
router.get('/me', auth, userController.getCurrentUser);
router.put('/me', auth, userController.updateUserProfile);
router.delete('/me', auth, userController.deleteUserAccount);

module.exports = router;