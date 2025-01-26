// Basic authentication middleware
export const authenticateRequest = (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            error: 'Missing authorization header'
        })
    }

    try {
        const [type, credentials] = authHeader.split(' ')

        if (type !== 'Basic') {
            return res.status(401).json({
                success: false,
                error: 'Invalid authorization type'
            })
        }

        const decoded = Buffer.from(credentials, 'base64').toString('utf-8')
        const [username, password] = decoded.split(':')

        // Simple credential check - should be environment variables in production
        if (username === 'admin' && password === 'admin123') {
            req.user = { username }
            next()
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            })
        }
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Invalid authorization header'
        })
    }
}