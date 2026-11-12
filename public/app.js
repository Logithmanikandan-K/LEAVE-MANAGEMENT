let userId = null;
let adminToken = null;

// Helper function to safely read API responses
async function readResponse(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

function clearFormFeedback(form) {
    form.querySelectorAll('.field-error').forEach((element) => {
        element.textContent = '';
    });
    form.querySelectorAll('.input-error').forEach((element) => {
        element.classList.remove('input-error');
        element.removeAttribute('aria-invalid');
    });

    const feedback = getFormFeedback(form);
    if (feedback) {
        feedback.textContent = '';
        feedback.classList.remove('success');
    }
}

function getFormFeedback(form) {
    const feedbackIds = {
        'login-form': 'student-login-feedback',
        'registration-form': 'registration-feedback',
        'admin-login-form': 'admin-login-feedback',
        'admin-setup-form': 'admin-setup-feedback'
    };

    return document.getElementById(feedbackIds[form.id]);
}

function validateAdminDetails(form) {
    const values = Object.fromEntries(new FormData(form));
    const errors = {};
    if (!values.username.trim()) errors.username = 'Enter a staff username.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = 'Enter a valid email address.';
    }
    if (values.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (!values.department.trim()) errors.department = 'Enter a department.';
    if (!values.designation.trim()) errors.designation = 'Enter a designation.';
    if (Object.keys(errors).length) {
        showFormErrors(form, errors);
        return null;
    }
    return values;
}

function showFormErrors(form, errors = {}, message = '') {
    clearFormFeedback(form);
    let hasFieldErrors = false;

    for (const [fieldName, errorMessage] of Object.entries(errors)) {
        const field = form.elements.namedItem(fieldName);
        if (!field || typeof field.classList === 'undefined') {
            continue;
        }

        field.classList.add('input-error');
        field.setAttribute('aria-invalid', 'true');
        const errorElement = [...form.querySelectorAll('.field-error')]
            .find((element) => element.dataset.errorFor === fieldName);
        if (errorElement) {
            errorElement.textContent = errorMessage;
            hasFieldErrors = true;
        }
    }

    const feedback = getFormFeedback(form);
    if (feedback && message && (!hasFieldErrors || !Object.keys(errors).length)) {
        feedback.textContent = message;
    }
}

function mapServerError(form, data) {
    if (data.fieldErrors && typeof data.fieldErrors === 'object') {
        showFormErrors(form, data.fieldErrors, data.message);
        return;
    }

    const message = data.message || 'Please check the highlighted information and try again.';
    const lowerMessage = message.toLowerCase();
    const errors = {};

    if (lowerMessage.includes('already registered') || lowerMessage.includes('already exists')) {
        if (form.elements.namedItem('email')) {
            errors.email = 'This email may already be registered.';
        }
        if (form.elements.namedItem('username')) {
            errors.username = 'This username may already be registered.';
        }
        if (form.elements.namedItem('rollNumber')) {
            errors.rollNumber = 'This roll number may already be registered.';
        }
    } else if (lowerMessage.includes('email')) {
        errors.email = message;
    } else if (lowerMessage.includes('password')) {
        errors.password = message;
    } else if (lowerMessage.includes('department')) {
        errors.department = message;
    } else if (lowerMessage.includes('designation')) {
        errors.designation = message;
    }

    showFormErrors(form, errors, message);
}

// Function to handle user registration
async function registerUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormFeedback(form);

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('student-register-password').value;
    const rollNumber = document.getElementById('roll-number').value.trim();
    const department = document.getElementById('user-department').value.trim();
    const casualLeave = Number(document.getElementById('casual-leave').value);
    const medicalLeave = Number(document.getElementById('medical-leave').value);

    const messageElement = document.getElementById('registration-feedback');
    const fieldErrors = {};

    if (!username) fieldErrors.username = 'Enter a username.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email address.';
    if (password.length < 8) fieldErrors.password = 'Password must be at least 8 characters.';
    if (!rollNumber) fieldErrors.rollNumber = 'Enter a roll number.';
    if (!department) fieldErrors.department = 'Enter a department.';
    if (!Number.isSafeInteger(casualLeave) || casualLeave < 0) {
        fieldErrors.casualLeave = 'Enter a non-negative whole number of casual leave days.';
    }
    if (!Number.isSafeInteger(medicalLeave) || medicalLeave < 0) {
        fieldErrors.medicalLeave = 'Enter a non-negative whole number of medical leave days.';
    }

    if (Object.keys(fieldErrors).length) {
        showFormErrors(form, fieldErrors);
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password,
                rollNumber,
                department,
                casualLeave,
                medicalLeave
            })
        });

        const data = await readResponse(response);

        if (response.ok) {
            messageElement.innerText = data.message || 'Registration successful! Please log in.';
            messageElement.classList.add('success');

            document.getElementById('registration-form').reset();
            document.getElementById('registration-section').style.display = 'none';
            document.getElementById('login-section').style.display = 'block';
        } else {
            mapServerError(form, data);
        }
    } catch (error) {
        console.error('Error registering user:', error);
        showFormErrors(form, {}, 'Could not register the student. Check the server connection and try again.');
    }
}

// Function to handle user login
async function loginUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormFeedback(form);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('student-password').value;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormErrors(form, { email: 'Enter a valid student email address.' });
        return;
    }
    if (!password) {
        showFormErrors(form, { password: 'Enter your password.' });
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await readResponse(response);

        if (response.ok) {
            if (data.userId == null) {
                showFormErrors(form, {}, 'Student login failed because the server did not return a user ID. Please try again.');
                return;
            }

            userId = data.userId;

            document.getElementById('username-display').innerText =
                `${data.username ?? ''} (${data.department ?? 'General'})`;
            document.getElementById('roll-number-display').innerText =
                data.rollNumber ?? '';
            document.getElementById('casual-leave-display').innerText =
                data.casualLeave ?? 0;
            document.getElementById('medical-leave-display').innerText =
                data.medicalLeave ?? 0;

            document.getElementById('balance-section').style.display = 'block';
            document.getElementById('apply-leave-section').style.display = 'block';
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('registration-section').style.display = 'none';
            document.getElementById('logout-button').style.display = 'block';
            renderStudentLeaveRequests(data.leaveRequests);

            document.getElementById('response-message').innerText =
                data.message || 'Login successful.';
            document.getElementById('login-form').reset();
        } else {
            mapServerError(form, data);
        }
    } catch (error) {
        console.error('Error logging in:', error);
        showFormErrors(form, {}, 'Could not log in. Check the server connection and try again.');
    }
}

async function loginAdmin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormFeedback(form);
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
        showFormErrors(form, {
            ...(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && { email: 'Enter a valid email address.' }),
            ...(!password && { password: 'Enter your password.' })
        });
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await readResponse(response);
        if (!response.ok) {
            showFormErrors(form, data.fieldErrors || {}, data.message);
            return;
        }
        adminToken = data.token;
        form.reset();
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('registration-section').style.display = 'none';
        document.getElementById('admin-login-section').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';
        document.getElementById('admin-profile').innerText =
            `${data.admin.username} — ${data.admin.department} (${data.admin.designation})`;
        await refreshAdminDashboard();
    } catch (error) {
        console.error('Error during staff login:', error);
        showFormErrors(form, {}, 'Could not log in. Check the server connection and try again.');
    }
}

async function createAdminAccount(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearFormFeedback(form);
    const details = validateAdminDetails(form);
    if (!details) return;

    try {
        const response = await fetch('/api/admin/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(details)
        });
        const data = await readResponse(response);
        if (!response.ok) {
            showFormErrors(form, data.fieldErrors || {}, data.message);
            return;
        }
        form.reset();
        showAdminLogin();
        document.getElementById('response-message').innerText =
            data.message || 'Staff account created. Sign in with your email and password.';
    } catch (error) {
        console.error('Error creating staff account:', error);
        showFormErrors(form, {}, 'Could not create the account. Check the server connection and try again.');
    }
}

async function adminRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${adminToken}`,
            ...(options.body && { 'Content-Type': 'application/json' })
        }
    });
    const data = await readResponse(response);
    if (!response.ok) {
        throw new Error(data.message || 'Staff request failed.');
    }
    return data;
}

async function refreshAdminDashboard() {
    const message = document.getElementById('admin-response-message');
    try {
        const [userData, requestData] = await Promise.all([
            adminRequest('/api/admin/users'),
            adminRequest('/api/admin/leave-requests')
        ]);
        renderAdminUsers(userData.users);
        renderAdminLeaveRequests(requestData.requests);
        message.innerText = `${userData.users.length} student(s) loaded.`;
    } catch (error) {
        console.error('Error loading staff dashboard:', error);
        message.innerText = error.message;
    }
}

function renderAdminUsers(users) {
    const body = document.getElementById('admin-users');
    body.replaceChildren();
    for (const user of users) {
        const row = document.createElement('tr');
        row.dataset.userId = user._id;
        for (const value of [
            user.username, user.email, user.rollNumber, user.department,
            user.casualLeave, user.medicalLeave
        ]) {
            addTableCell(row, value);
        }
        const actions = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.userAction = 'delete';
        button.textContent = 'Delete';
        actions.append(button);
        row.append(actions);
        body.append(row);
    }
}

async function manageAdminUser(event) {
    const button = event.target.closest('button[data-user-action]');
    if (!button) return;
    const row = button.closest('tr');
    const userId = row.dataset.userId;
    try {
        if (!window.confirm('Delete this student account?')) return;
        await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        await refreshAdminDashboard();
    } catch (error) {
        document.getElementById('admin-response-message').innerText = error.message;
    }
}

function renderAdminLeaveRequests(requests) {
    const body = document.getElementById('admin-leave-requests');
    body.replaceChildren();
    for (const request of requests) {
        const row = document.createElement('tr');
        row.dataset.userId = request.userId;
        row.dataset.requestId = request.requestId;
        for (const value of [
            `${request.username} (${request.rollNumber})`, request.department,
            request.type, request.days, request.reason,
            new Date(request.createdAt).toLocaleString(), request.status
        ]) {
            addTableCell(row, value);
        }
        const noteCell = document.createElement('td');
        noteCell.dataset.label = 'Admin note';
        if (request.status === 'pending') {
            const noteInput = document.createElement('textarea');
            noteInput.name = 'reviewNote';
            noteInput.rows = 2;
            noteInput.maxLength = 1000;
            noteInput.placeholder = 'Add a note for the student (optional)';
            noteInput.setAttribute('aria-label', `Review note for ${request.username}'s ${request.type} leave request`);
            noteInput.value = request.reviewNote || '';
            noteCell.append(noteInput);
        } else {
            noteCell.textContent = request.reviewNote || '';
        }
        row.append(noteCell);

        const actions = document.createElement('td');
        if (request.status === 'pending') {
            for (const action of ['approve', 'disapprove']) {
                const button = document.createElement('button');
                button.type = 'button';
                button.dataset.action = action;
                button.textContent = action;
                actions.append(button);
            }
        }
        row.append(actions);
        body.append(row);
    }
}

async function reviewLeaveRequest(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr');
    const note = row.querySelector('textarea[name="reviewNote"]')?.value.trim() || '';
    try {
        await adminRequest(
            `/api/admin/leave-requests/${encodeURIComponent(row.dataset.userId)}/${encodeURIComponent(row.dataset.requestId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ action: button.dataset.action, note })
            }
        );
        await refreshAdminDashboard();
    } catch (error) {
        document.getElementById('admin-response-message').innerText = error.message;
    }
}

function logoutAdmin() {
    adminToken = null;
    document.getElementById('admin-dashboard').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('admin-users').replaceChildren();
    document.getElementById('admin-leave-requests').replaceChildren();
    document.getElementById('admin-profile').innerText = '';
}

function addTableCell(row, value, label = '') {
    const cell = document.createElement('td');
    cell.textContent = value == null ? '' : String(value);
    if (label) {
        cell.dataset.label = label;
    }
    row.append(cell);
    return cell;
}

function renderStudentLeaveRequests(requests = []) {
    const tableBody = document.getElementById('student-leave-requests');
    tableBody.replaceChildren();

    for (const request of requests) {
        const row = document.createElement('tr');
        addTableCell(row, request.type, 'Type');
        addTableCell(row, request.days, 'Days');
        addTableCell(row, request.reason, 'Reason');
        addTableCell(row, new Date(request.createdAt).toLocaleString(), 'Submitted');
        addTableCell(row, request.status, 'Status');
        addTableCell(row, request.reviewNote, 'Review note');
        tableBody.append(row);
    }
}

// Function to handle user logout
function logoutUser() {
    userId = null;

    document.getElementById('balance-section').style.display = 'none';
    document.getElementById('apply-leave-section').style.display = 'none';
    document.getElementById('logout-button').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('registration-section').style.display = 'none';
    document.getElementById('student-leave-requests').replaceChildren();

    document.getElementById('response-message').innerText = '';
    document.getElementById('registration-response').innerText = '';

    document.getElementById('username-display').innerText = '';
    document.getElementById('roll-number-display').innerText = '';
    document.getElementById('casual-leave-display').innerText = 'Loading...';
    document.getElementById('medical-leave-display').innerText = 'Loading...';

    document.getElementById('login-form').reset();
    document.getElementById('leave-form').reset();
}

// Function to refresh leave balance
async function refreshLeaveBalance() {
    if (userId == null) {
        document.getElementById('response-message').innerText =
            'Please log in first.';
        return;
    }

    try {
        const response = await fetch(
            `/api/leave-balance/${encodeURIComponent(userId)}`
        );

        const data = await readResponse(response);

        if (response.ok) {
            document.getElementById('casual-leave-display').innerText =
                data.casualLeave ?? 0;
            document.getElementById('medical-leave-display').innerText =
                data.medicalLeave ?? 0;
            renderStudentLeaveRequests(data.leaveRequests);
            document.getElementById('response-message').innerText =
                data.message || 'Leave balance updated.';
        } else {
            document.getElementById('response-message').innerText =
                data.message || 'Error fetching leave balance.';
        }
    } catch (error) {
        console.error('Error refreshing balance:', error);
        document.getElementById('response-message').innerText =
            'Server error. Please try again.';
    }
}

// Function to apply for leave
async function applyLeave(event) {
    event.preventDefault();

    if (userId == null) {
        document.getElementById('response-message').innerText =
            'Please log in before applying for leave.';
        return;
    }

    const type = document.getElementById('leave-type').value;
    const days = Number(document.getElementById('leave-days').value);
    const reason = document.getElementById('leave-reason').value.trim();
    const messageElement = document.getElementById('response-message');

    if (!type || !Number.isInteger(days) || days <= 0 || !reason) {
        messageElement.innerText =
            'Please select a leave type, enter valid days, and provide a reason.';
        return;
    }

    try {
        const response = await fetch(
            `/api/apply-leave/${encodeURIComponent(userId)}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type, days, reason })
            }
        );

        const data = await readResponse(response);

        if (response.ok) {
            document.getElementById('casual-leave-display').innerText =
                data.casualLeave ?? 0;
            document.getElementById('medical-leave-display').innerText =
                data.medicalLeave ?? 0;
            renderStudentLeaveRequests(data.leaveRequests);

            messageElement.innerText =
                data.message || 'Leave request submitted for staff review.';

            document.getElementById('leave-form').reset();
        } else {
            messageElement.innerText =
                data.message || 'Error applying for leave.';
        }
    } catch (error) {
        console.error('Error applying for leave:', error);
        messageElement.innerText = 'Server error. Please try again.';
    }
}

// Show the login section
function showLogin() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('registration-section').style.display = 'none';
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-setup-section').style.display = 'none';
}

// Show the registration section
function showRegistration() {
    document.getElementById('registration-section').style.display = 'block';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('admin-setup-section').style.display = 'none';
}

function showAdminLogin() {
    document.getElementById('admin-login-section').style.display = 'block';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('registration-section').style.display = 'none';
    document.getElementById('admin-setup-section').style.display = 'none';
}

function showAdminSetup() {
    document.getElementById('admin-setup-section').style.display = 'block';
    document.getElementById('admin-login-section').style.display = 'none';
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('registration-section').style.display = 'none';
}

// Register event listeners after the HTML has loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('registration-form')
        .addEventListener('submit', registerUser);

    document.getElementById('login-form')
        .addEventListener('submit', loginUser);

    document.getElementById('admin-login-form')
        .addEventListener('submit', loginAdmin);

    document.getElementById('admin-setup-form')
        .addEventListener('submit', createAdminAccount);

    document.getElementById('admin-leave-requests')
        .addEventListener('click', reviewLeaveRequest);

    document.getElementById('admin-users')
        .addEventListener('click', manageAdminUser);

    document.getElementById('admin-logout-button')
        .addEventListener('click', logoutAdmin);

    document.getElementById('refresh-users')
        .addEventListener('click', refreshAdminDashboard);

    document.getElementById('refresh-balance')
        .addEventListener('click', refreshLeaveBalance);

    document.getElementById('logout-button')
        .addEventListener('click', logoutUser);

    document.getElementById('leave-form')
        .addEventListener('submit', applyLeave);

    document.getElementById('show-login')
        .addEventListener('click', showLogin);

    document.getElementById('show-registration')
        .addEventListener('click', showRegistration);

    document.getElementById('show-admin-login')
        .addEventListener('click', showAdminLogin);

    document.getElementById('show-admin-setup')
        .addEventListener('click', showAdminSetup);

    document.getElementById('back-to-login')
        .addEventListener('click', showLogin);

    document.getElementById('back-from-setup')
        .addEventListener('click', showAdminLogin);

    for (const form of document.querySelectorAll('form')) {
        form.addEventListener('input', (event) => {
            const field = event.target;
            if (!field.name) {
                return;
            }

            field.classList.remove('input-error');
            field.removeAttribute('aria-invalid');
            const errorElement = [...form.querySelectorAll('.field-error')]
                .find((element) => element.dataset.errorFor === field.name);
            if (errorElement) {
                errorElement.textContent = '';
            }
        });
    }
});