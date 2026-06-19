const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'TourGo API Service is running',
        version: '1.0.0'
    });
});

app.use('/api/admin', require('./src/routes/admin.routes'));
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/users', require('./src/routes/user.routes'));
app.use('/api/tours', require('./src/routes/tour.routes'));
app.use('/api/hotels', require('./src/routes/hotel.routes'));
app.use('/api/bookings', require('./src/routes/booking.routes'));
app.use('/api/favorites', require('./src/routes/favorite.routes'));
app.use('/api/reviews', require('./src/routes/review.routes'));

app.use(require('./src/middleware/notFound'));
app.use(require('./src/middleware/errorHandler'));

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`TourGo API Service is running on http://${HOST}:${PORT}`);
});

module.exports = app;
