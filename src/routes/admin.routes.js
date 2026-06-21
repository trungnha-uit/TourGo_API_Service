const router = require('express').Router();
const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

router.get('/users', auth, adminOnly, adminController.getAllUsers);
router.put('/users/:userId/suspend', auth, adminOnly, adminController.suspendUser);
router.put('/users/:userId/flagged', auth, adminOnly, adminController.flagUser);
router.put('/users/:userId/activate', auth, adminOnly, adminController.activateUser);

router.get('/businesses/pending', auth, adminOnly, adminController.getPendingBusinesses);
router.get('/businesses/approved', auth, adminOnly, adminController.getApprovedBusinesses);
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

// Profile — team
router.get('/team', auth, adminOnly, adminController.getTeam);
router.post('/team/invite', auth, adminOnly, adminController.inviteAdmin);
router.put('/team/:userId/role', auth, adminOnly, adminController.changeAdminRole);
router.delete('/team/:userId', auth, adminOnly, adminController.removeAdmin);

// Profile — audit log (paginated) + CSV export
router.get('/audit-log/export', auth, adminOnly, adminController.exportAuditLog);
router.get('/audit-log', auth, adminOnly, adminController.getAuditLog);

// Profile — settings (moderation policy + notification preferences)
router.get('/settings/moderation', auth, adminOnly, adminController.getModerationPolicy);
router.put('/settings/moderation', auth, adminOnly, adminController.updateModerationPolicy);
router.get('/settings/notifications', auth, adminOnly, adminController.getNotificationPrefs);
router.put('/settings/notifications', auth, adminOnly, adminController.updateNotificationPrefs);

module.exports = router;