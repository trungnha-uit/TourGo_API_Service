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

// Dashboard
router.get('/stats', auth, adminOnly, adminController.getStats);
router.get('/activity', auth, adminOnly, adminController.getActivity);

// Reports (Moderation)
router.get('/reports', auth, adminOnly, adminController.getReports);
router.put('/reports/:reportId/dismiss', auth, adminOnly, adminController.dismissReport);
router.put('/reports/:reportId/resolve', auth, adminOnly, adminController.resolveReport);

// Profile
router.get('/team', auth, adminOnly, adminController.getTeam);
router.get('/audit-log', auth, adminOnly, adminController.getAuditLog);

module.exports = router;