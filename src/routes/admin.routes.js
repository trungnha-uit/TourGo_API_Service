const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.get('/users', auth, adminOnly, adminController.getAllUsers);
router.put('/users/:userId/suspend', auth, adminOnly, adminController.suspendUser);
router.put('/users/:userId/flagged', auth, adminOnly, adminController.flagUser);
router.put('/users/:userId/activate', auth, adminOnly, adminController.activateUser);

router.get('/businesses/pending', auth, adminOnly, adminController.getPendingBusinesses);
router.put('/businesses/:businessId/approve', auth, adminOnly, adminController.approveBusiness);
router.put('/businesses/:businessId/suspend', auth, adminOnly, adminController.suspendBusiness);
router.put('/businesses/:businessId/reject', auth, adminOnly, adminController.rejectBusiness);

module.exports = router;