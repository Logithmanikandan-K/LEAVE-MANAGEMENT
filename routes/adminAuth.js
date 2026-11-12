const crypto = require('crypto');
const { promisify } = require('util');
const Admin = require('../model/Admin');

const scrypt = promisify(crypto.scrypt);
const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');

const constantTimeCompare = (value, expected) => {
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);

    return valueBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(valueBuffer, expectedBuffer);
};

const hashPassword = async (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const hash = await scrypt(password, salt, 64);
    return { passwordSalt: salt, passwordHash: hash.toString('hex') };
};

const verifyPassword = async (password, admin) => {
    if (!admin.passwordSalt || !admin.passwordHash) {
        return false;
    }

    const { passwordHash } = await hashPassword(password, admin.passwordSalt);
    return constantTimeCompare(passwordHash, admin.passwordHash);
};

const createToken = (admin) => {
    const payload = Buffer.from(JSON.stringify({
        adminId: admin._id.toString(),
        exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS
    })).toString('base64url');
    const signature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');

    return `${payload}.${signature}`;
};

const verifyToken = (token) => {
    if (typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
        return null;
    }

    const [payload, signature] = parts;
    const expectedSignature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('base64url');
    if (!constantTimeCompare(signature, expectedSignature)) {
        return null;
    }

    try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (
            typeof claims.adminId !== 'string' ||
            !/^[a-fA-F0-9]{24}$/.test(claims.adminId) ||
            !Number.isInteger(claims.exp) ||
            claims.exp <= Math.floor(Date.now() / 1000)
        ) {
            return null;
        }
        return claims;
    } catch {
        return null;
    }
};

const requireAdmin = async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    const claims = match ? verifyToken(match[1]) : null;

    if (!claims) {
        return res.status(401).json({ message: 'Admin authentication required.' });
    }

    try {
        const admin = await Admin.findById(claims.adminId)
            .select('username email department designation');
        if (!admin) {
            return res.status(401).json({ message: 'Admin account no longer exists.' });
        }
        req.admin = admin;
        return next();
    } catch (error) {
        console.error('Error validating admin session:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
};

module.exports = {
    createToken,
    hashPassword,
    requireAdmin,
    verifyPassword
};
