const notFound = (req, res) => {
    res.status(404).json({
        success: false,
        data: null,
        error: 'NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
};

module.exports = notFound;
