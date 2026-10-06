AFGHAN ONLINE BAZAAR — GLOBAL PRODUCTION EDITION v5
====================================================

Founder / Project credit
------------------------
Afghan Online Bazaar (AOB)
By Ali Azimi
Contact: alikhanazemi@gmail.com

Mission
-------
AOB is designed to make online shopping and selling easier, safer and more accessible
for Afghans. The project is intentionally designed so AI can be used positively:
shopping assistance, translation, seller tools, recommendations, moderation and support.

Current working foundation
--------------------------
- Marketplace catalog
- Search and categories
- AFN + USD data model
- Customer / Seller / Admin roles
- Registration and login
- Password hashing
- Session authentication
- Seller product creation
- Cart and order workflow
- Cash on Delivery
- Delivery address
- Order status/tracking/courier fields
- Wishlist
- Reviews
- Notifications
- Messaging API
- Returns/refund-request data model
- Admin statistics
- Audit logs
- Security headers
- Rate limiting
- Responsive multilingual UI
- Languages: Pashto, Dari/Persian, English, Chinese, Urdu, French
- International shipping architecture ready for future provider adapters
- Branding asset included

Run locally
-----------
1) Install Node.js 20+.
2) Copy .env.example to .env and set SESSION_SECRET.
3) npm install
4) npm start
5) Open http://localhost:3000

Demo accounts
-------------
Admin:
admin@aob.af
Admin123!

Seller:
seller@aob.af
Seller123!

IMPORTANT: Change/remove demo credentials before any public deployment.

Production integrations that require real accounts/credentials
---------------------------------------------------------------
1. Domain: afghanonlinebazaar.com
2. Production hosting/VPS/cloud
3. Real payment gateway/merchant account
4. SMS/OTP provider
5. Business email/SMTP
6. Delivery/courier provider APIs for Afghanistan
7. AI API key
8. Object storage/CDN for product images
9. Production PostgreSQL
10. Monitoring/error tracking
11. Backups
12. Legal business policies: Terms, Privacy, Returns, Seller Agreement

International shipping
----------------------
The data model already contains courier/tracking concepts. Do not hard-code a single
courier. Build provider adapters so Afghan delivery and future international carriers
can be plugged in without rewriting checkout.

Before launch checklist
-----------------------
- HTTPS
- Strong SESSION_SECRET
- Secure cookies
- PostgreSQL instead of SQLite
- CSRF protection
- Input validation
- Upload validation and malware scanning
- Payment webhook signature verification
- Rate limiting per auth/payment endpoint
- Database backups + restore test
- Error monitoring
- Audit logging
- Privacy/terms/returns pages
- Seller verification
- Refund/dispute policy
- Real delivery SLAs
- Real payment provider testing
- Penetration/security review


FREE DEMO URL OPTION
--------------------
A purchased domain is NOT required for the first public demo.
Recommended for this Node/Express demo: Render Web Service. Render assigns a free
`*.onrender.com` URL after deployment. The exact URL is assigned only after the
project is deployed, so it cannot honestly be reserved or claimed in advance.
See `DEPLOY_RENDER.md` for the exact deployment steps.

OWNER-EDITABLE ITEMS
--------------------
Open the ⚙️ button in the website header:
- Project name
- Contact email
- Support phone
- Office/address
- General delivery fee
- About/Mission text
- Social link

These settings are currently stored in the browser for the demo. For production,
move them into the authenticated Admin Settings database table/API so they apply
globally to all visitors.

DO NOT ENTER SECRETS IN OWNER SETTINGS
--------------------------------------
Never put payment keys, AI keys, SMTP passwords, SMS secrets or server passwords
in the browser settings. Those belong in server-side environment variables.


AI ASSISTANT
------------
AOB v6 now includes a customer-facing AI Assistant panel. It can:
- Understand basic shopping questions
- Recommend products from the live catalog
- Filter by budget
- Help with orders/tracking for logged-in users
- Explain Afghanistan delivery
- Guide users to account/help flows
- Work in the multilingual UI

The included endpoint is a safe local fallback/rule-based assistant so the demo
works without exposing any API key. For production-quality natural-language
conversation, connect a real AI provider on the SERVER using AOB_AI_API_KEY and
AOB_AI_MODEL. Never put the key in browser/localStorage.

The AI architecture should later add:
- conversation memory per user
- product recommendation/ranking
- multilingual translation
- seller copilot
- image/product understanding
- returns/refund guidance
- fraud/safety moderation
- human support handoff


PRODUCTION FOUNDATION v7
------------------------
This package adds:
- same-origin write protection
- seller product list/edit/archive
- seller order view
- admin user/seller management
- seller verification
- admin returns management
- admin audit log endpoint
- public policies endpoint
- search suggestions
- basic admin/seller/customer dashboards
- Vercel and Render deployment configurations
- live-launch checklist

This is a production-oriented foundation, not a claim that external providers are
already connected. Payment, SMS, email, AI and courier services need real provider
credentials and production testing before launch.


## Global Authentication v8
Email OR international phone login, registration, password login, logout and OTP provider endpoint are included. Real SMS/email OTP requires provider credentials; secrets must remain server-side. Production password hashing should use Argon2id/bcrypt rather than the demo hash.


## Authentication Hardening v9
Passwords now use server-side scrypt hashing with a configurable pepper.
OTP challenges have expiry, attempt limits and server-side verification.
Account recovery avoids revealing whether an email/phone exists.
For production, configure real SMS and transactional email providers and strong
random environment secrets.
