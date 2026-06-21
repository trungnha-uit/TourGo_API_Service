const router = require('express').Router();

const userController =
require('../controllers/user.controller');

const auth =
require('../middleware/auth');

const businessAuth =
require('../middleware/businessesAuth');

const upload =
require('../middleware/upload');

router.get(
    '/me',
    auth,
    userController.getCurrentUser
);

router.put(
    '/me',
    auth,
    upload.single('avatar'), // sửa file -> avatar
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

// Business registration detail — returns the user's own application for ANY
// status (pending / rejected / active) so the registration-detail screen can
// show its full contents. Intentionally NOT behind businessAuth, which would
// reject not-yet-approved applicants and hide their details.
router.get(
    '/businesses/me',
    auth,
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