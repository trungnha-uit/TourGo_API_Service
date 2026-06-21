const router = require('express').Router();
const notificationController = require('../controllers/notification.controller');
const auth = require('../middleware/auth');

router.get('/', auth, notificationController.getNotifications);
router.patch('/read-all', auth, notificationController.markAllAsRead);
router.patch('/:id/read', auth, notificationController.markAsRead);

module.exports = router;
