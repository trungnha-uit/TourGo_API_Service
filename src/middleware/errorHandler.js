const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            data: null,
            error: 'VALIDATION_ERROR',
            message: err.message
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            data: null,
            error: 'UNAUTHORIZED',
            message: 'Invalid token'
        });
    }

    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            data: null,
            error: 'SERVICE_UNAVAILABLE',
            message: 'Database connection failed'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        data: null,
        error: err.code || 'SERVER_ERROR',
        message: err.message || 'Internal server error'
    });
};

module.exports = errorHandler;
