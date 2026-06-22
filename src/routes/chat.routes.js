const router = require('express').Router();
const chatController = require('../controllers/chat.controller');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/rooms', auth, chatController.getOrCreateRoom);
router.get('/rooms', auth, chatController.getRooms);
router.get('/rooms/:roomId/messages', auth, chatController.getMessages);
router.post('/rooms/:roomId/messages', auth, chatController.sendMessage);
router.post('/rooms/:roomId/messages/image', auth, upload.single('image'), chatController.sendImageMessage);

module.exports = router;
