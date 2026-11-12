const express = require('express');
const router = express.Router();
const User = require('../model/User');
const Admin = require('../model/Admin');
const {
    createToken,
    hashPassword,
    requireAdmin,
    verifyPassword
} = require('./adminAuth');

const isValidUserId = (id) => /^[a-fA-F0-9]{24}$/.test(id);
const isValidObjectId = isValidUserId;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getAdminFieldErrors = (details) => {
    const errors = {};

    if (typeof details.username !== 'string' || !details.username.trim()) {
        errors.username = 'Enter an admin username.';
    }
    if (typeof details.email !== 'string' || !emailRegex.test(details.email.trim())) {
        errors.email = 'Enter a valid admin email address.';
    }
    if (typeof details.password !== 'string' || details.password.length < 8) {
        errors.password = 'Password must be at least 8 characters.';
    }
    if (typeof details.department !== 'string' || !details.department.trim()) {
        errors.department = 'Enter a department.';
    }
    if (typeof details.designation !== 'string' || !details.designation.trim()) {
        errors.designation = 'Enter a designation.';
    }

    return errors;
};

const createAdmin = async (details) => {
    const credentials = await hashPassword(details.password);
    return Admin.create({
        username: details.username.trim(),
        email: details.email.trim().toLowerCase(),
        department: details.department.trim(),
        designation: details.designation.trim(),
        ...credentials
    });
};

// Route to handle user registration
router.post('/register', async (req, res) => {
    const {
        username,
        email,
        rollNumber,
        password,
        department = 'General',
        casualLeave = 0,
        medicalLeave = 0
    } = req.body || {};

    try {
        const fieldErrors = {};
        if (typeof username !== 'string' || !username.trim()) {
            fieldErrors.username = 'Enter a username.';
        }
        if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
            fieldErrors.email = 'Enter a valid email address.';
        }
        if (typeof password !== 'string' || password.length < 8) {
            fieldErrors.password = 'Password must be at least 8 characters.';
        }
        if (typeof rollNumber !== 'string' || !rollNumber.trim()) {
            fieldErrors.rollNumber = 'Enter a roll number.';
        }
        if (typeof department !== 'string' || !department.trim()) {
            fieldErrors.department = 'Enter a department.';
        }
        if (!Number.isSafeInteger(casualLeave) || casualLeave < 0) {
            fieldErrors.casualLeave = 'Enter a non-negative whole number of casual leave days.';
        }
        if (!Number.isSafeInteger(medicalLeave) || medicalLeave < 0) {
            fieldErrors.medicalLeave = 'Enter a non-negative whole number of medical leave days.';
        }

        if (Object.keys(fieldErrors).length) {
            return res.status(400).json({
                message: 'Correct the highlighted student details.',
                fieldErrors
            });
        }

        // Check whether the email already exists
        const existingUser = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingUser) {
            return res.status(400).json({
                message: 'This email is already registered.',
                fieldErrors: { email: 'This email is already registered.' }
            });
        }

        // Create the user
        const credentials = await hashPassword(password);
        const newUser = new User({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            rollNumber: rollNumber.trim(),
            department: department.trim(),
            casualLeave,
            medicalLeave,
            ...credentials
        });

        await newUser.save();

        return res.status(201).json({
            message: 'User created successfully.',
            userId: newUser._id,
            username: newUser.username,
            rollNumber: newUser.rollNumber,
            casualLeave: newUser.casualLeave,
            medicalLeave: newUser.medicalLeave
        });
    } catch (error) {
        console.error('Error creating user:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: 'This email is already registered.',
                fieldErrors: { email: 'This email is already registered.' }
            });
        }

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Invalid user details.'
            });
        }

        return res.status(500).json({
            message: 'Server error.'
        });
    }
});

router.post('/admin/register', async (req, res) => {
    const details = req.body || {};
    const fieldErrors = getAdminFieldErrors(details);
    if (Object.keys(fieldErrors).length) {
        return res.status(400).json({
            message: 'Correct the highlighted admin details.',
            fieldErrors
        });
    }

    try {
        const admin = await createAdmin(details);
        return res.status(201).json({
            message: 'Staff account created. You can now sign in.',
            adminId: admin._id
        });
    } catch (error) {
        console.error('Error registering staff account:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'This staff username or email is already registered.',
                fieldErrors: {
                    username: 'This username may already be registered.',
                    email: 'This email may already be registered.'
                }
            });
        }
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.post('/admin/login', async (req, res) => {
    const { email, password } = req.body || {};
    const fieldErrors = {};
    if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
        fieldErrors.email = 'Enter a valid admin email address.';
    }
    if (typeof password !== 'string' || !password) {
        fieldErrors.password = 'Enter your admin password.';
    }
    if (Object.keys(fieldErrors).length) {
        return res.status(400).json({
            message: 'Enter a valid admin email and password.',
            fieldErrors
        });
    }

    try {
        const admin = await Admin.findOne({
            email: email.trim().toLowerCase()
        }).select('+passwordHash +passwordSalt');
        if (!admin || !(await verifyPassword(password, admin))) {
            return res.status(401).json({
                message: 'The email or password is incorrect.',
                fieldErrors: {
                    email: 'Check the admin email address.',
                    password: 'The email or password is incorrect.'
                }
            });
        }

        return res.json({
            message: 'Admin login successful.',
            token: createToken(admin),
            admin: {
                username: admin.username,
                email: admin.email,
                department: admin.department,
                designation: admin.designation
            }
        });
    } catch (error) {
        console.error('Error during admin login:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.use('/admin', requireAdmin);

router.get('/admin/users', async (req, res) => {
    try {
        const users = await User.find({})
            .select('username email rollNumber department casualLeave medicalLeave')
            .sort({ username: 1 })
            .lean();
        return res.json({ users });
    } catch (error) {
        console.error('Error fetching admin user list:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.delete('/admin/users/:id', async (req, res) => {
    if (!isValidUserId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid user ID.' });
    }
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        return res.json({ message: 'Student account deleted.' });
    } catch (error) {
        console.error('Error deleting student account:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.get('/admin/leave-requests', async (req, res) => {
    try {
        const users = await User.find({ 'leaveRequests.0': { $exists: true } })
            .select('username email rollNumber department leaveRequests')
            .lean();
        const requests = users.flatMap((user) => user.leaveRequests.map((request) => ({
            userId: user._id,
            username: user.username,
            email: user.email,
            rollNumber: user.rollNumber,
            department: user.department,
            requestId: request._id,
            type: request.type,
            days: request.days,
            reason: request.reason,
            status: request.status,
            createdAt: request.createdAt,
            reviewNote: request.reviewNote
        })));
        requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return res.json({ requests });
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

router.patch('/admin/leave-requests/:userId/:requestId', async (req, res) => {
    const { userId, requestId } = req.params;
    const { action, note = '' } = req.body || {};
    if (!isValidObjectId(userId) || !isValidObjectId(requestId)) {
        return res.status(400).json({ message: 'Invalid leave request ID.' });
    }
    if (!['approve', 'disapprove'].includes(action)) {
        return res.status(400).json({ message: 'Choose approve or disapprove.' });
    }
    if (typeof note !== 'string' || note.length > 1000) {
        return res.status(400).json({ message: 'Review note must be 1000 characters or fewer.' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const request = user.leaveRequests.id(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }
        if (request.status !== 'pending') {
            return res.status(409).json({ message: 'This leave request has already been reviewed.' });
        }
        if (action === 'approve') {
            const leaveField = request.type === 'casual' ? 'casualLeave' : 'medicalLeave';
            if (user[leaveField] < request.days) {
                return res.status(400).json({ message: `Insufficient ${request.type} leave balance.` });
            }
            user[leaveField] -= request.days;
        }
        request.status = action === 'approve' ? 'approved' : 'disapproved';
        request.reviewedAt = new Date();
        request.reviewedBy = req.admin._id;
        request.reviewNote = note.trim();
        await user.save();

        return res.json({
            message: action === 'approve' ? 'Leave request approved.' : 'Leave request disapproved.',
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave
        });
    } catch (error) {
        console.error('Error reviewing leave request:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// Route to handle user login
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};

    try {
        const fieldErrors = {};
        if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
            fieldErrors.email = 'Enter a valid student email address.';
        }
        if (typeof password !== 'string' || !password) {
            fieldErrors.password = 'Enter your password.';
        }
        if (Object.keys(fieldErrors).length) {
            return res.status(400).json({
                message: 'Enter your student email and password.',
                fieldErrors
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        }).select('+passwordHash +passwordSalt');

        if (!user || !(await verifyPassword(password, user))) {
            return res.status(401).json({
                message: 'The email or password is incorrect.',
                fieldErrors: {
                    email: 'Check your student email address.',
                    password: 'The email or password is incorrect.'
                }
            });
        }

        return res.json({
            message: 'Login successful.',
            userId: user._id,
            username: user.username,
            rollNumber: user.rollNumber,
            department: user.department,
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave,
            leaveRequests: user.leaveRequests
        });
    } catch (error) {
        console.error('Error during login:', error);

        return res.status(500).json({
            message: 'Server error.'
        });
    }
});

// Route to get leave balance by user ID
router.get('/leave-balance/:id', async (req, res) => {
    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid user ID.'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found.'
            });
        }

        return res.json({
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave,
            leaveRequests: user.leaveRequests
        });
    } catch (error) {
        console.error('Error fetching leave balance:', error);

        return res.status(500).json({
            message: 'Server error.'
        });
    }
});

// Leave balances are deducted only when staff approve a pending request.
router.post('/apply-leave/:id', async (req, res) => {
    const { type, days, reason } = req.body || {};

    try {
        if (!isValidUserId(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid user ID.'
            });
        }

        // Validate leave type
        if (type !== 'casual' && type !== 'medical') {
            return res.status(400).json({
                message: 'Invalid leave type.'
            });
        }

        // Require a positive integer
        if (
            !Number.isSafeInteger(days) ||
            days <= 0
        ) {
            return res.status(400).json({
                message: 'Number of days must be a positive integer.'
            });
        }

        if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
            return res.status(400).json({
                message: 'A reason of 1 to 1000 characters is required.'
            });
        }

        const leaveField =
            type === 'casual' ? 'casualLeave' : 'medicalLeave';
        const user = await User.findOneAndUpdate(
            {
                _id: req.params.id,
                [leaveField]: { $gte: days }
            },
            {
                $push: {
                    leaveRequests: {
                        type,
                        days,
                        reason: reason.trim(),
                        status: 'pending'
                    }
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!user) {
            const existingUser = await User.findById(req.params.id)
                .select('casualLeave medicalLeave');

            if (existingUser) {
                return res.status(400).json({
                    message: `Insufficient ${type} leave balance for this request.`
                });
            }

            return res.status(404).json({
                message: 'User not found.'
            });
        }

        return res.json({
            message: 'Leave request submitted and is awaiting staff review.',
            casualLeave: user.casualLeave,
            medicalLeave: user.medicalLeave,
            leaveRequests: user.leaveRequests
        });
    } catch (error) {
        console.error('Error applying for leave:', error);

        return res.status(500).json({
            message: 'Server error.'
        });
    }
});

module.exports = router;