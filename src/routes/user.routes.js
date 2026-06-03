const router = require('express').Router();
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth');
const businessAuth = require('../middleware/businessesAuth');

router.get('/me', auth, userController.getCurrentUser);
router.put('/me', auth, userController.updateUserProfile);
router.delete('/me', auth, userController.deleteUserAccount);

router.post('/businesses/register', auth, userController.registerBusiness);
router.get('/businesses/me', auth, businessAuth, userController.getMyBusiness);
router.put('/businesses/me', auth, businessAuth, userController.updateBusinessProfile);
router.delete('/businesses/me', auth, businessAuth, userController.deleteBusinessAccount);

module.exports = router;