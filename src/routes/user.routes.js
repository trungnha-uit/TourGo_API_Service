const router = require('express').Router();

const userController =
require('../controllers/user.controller');

const auth =
require('../middleware/auth');

const businessAuth =
require('../middleware/businessesAuth');

const upload =
require('../middleware/upload'); // thêm

router.get(
    '/me',
    auth,
    userController.getCurrentUser
);

router.put(
    '/me',
    auth,
    upload.single('file'), // thêm
    userController.updateUserProfile
);

router.delete(
    '/me',
    auth,
    userController.deleteUserAccount
);

router.post(
    '/businesses/register',
    auth,
    userController.registerBusiness
);

router.get(
    '/businesses/me',
    auth,
    businessAuth,
    userController.getMyBusiness
);

router.get(
    '/businesses/me/listings',
    auth,
    businessAuth,
    userController.getMyListings
);

router.put(
    '/businesses/me',
    auth,
    businessAuth,
    userController.updateBusinessProfile
);

router.delete(
    '/businesses/me',
    auth,
    businessAuth,
    userController.deleteBusinessAccount
);

module.exports = router;