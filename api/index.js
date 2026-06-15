module.exports = (req, res) => {
    res.status(404).json({ error: 'Use root path instead' });
};
