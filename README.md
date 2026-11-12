# Leave Management System

## Accounts and sign-in

Start the application and open `http://localhost:5050`. No admin setup key or session secret environment variable is required.

- Students create an account with their details and a password of at least 8 characters, then sign in with their email and password.
- Staff select **Staff Login**, then **Create Staff Account** on the staff login page to register. Staff sign in with their email and password.

Staff registration is open: anyone who can access the staff registration page can create a staff account with dashboard access. Keep the application on a trusted network if that is not intended.

Passwords are stored as salted scrypt hashes. Staff sessions expire after eight hours and are signed with a random in-memory secret, so restarting the server signs out current staff. Serve the application over HTTPS outside local development.

Accounts created before passwords were required need to be migrated or recreated before they can sign in.

Students submit leave requests with a reason; the request remains pending and does not change the balance until staff approve it. Disapproved requests do not deduct leave. Staff can review requests, approve or disapprove them with an optional note, and delete student accounts. Students can review their request history and status.
