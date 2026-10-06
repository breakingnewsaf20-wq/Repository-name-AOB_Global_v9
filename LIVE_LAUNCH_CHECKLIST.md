# AOB — Live Launch Checklist

## Ready in this package
- Marketplace core
- Customer/Seller/Admin roles
- AI assistant fallback
- Seller product management
- Admin order/user/return management
- Order tracking fields
- Wishlist/reviews/notifications/messages
- AFN + USD
- 6 languages UI
- Security headers
- Rate limiting
- Same-origin write guard
- Audit logs
- Vercel configuration
- Render configuration

## Still requires your real provider accounts
1. Hosting account (Vercel/Render/etc.)
2. PostgreSQL production database (recommended; SQLite is for demo/local only)
3. Real AI provider API
4. Payment merchant/provider
5. SMS/OTP provider
6. Email/SMTP
7. Afghanistan delivery/courier integration
8. Object storage/CDN for images
9. Domain `afghanonlinebazaar.com` when purchased

## Before public launch
- Set a strong SESSION_SECRET
- Do not use demo passwords
- Use PostgreSQL
- Enable HTTPS
- Configure real AI provider server-side
- Configure payment webhooks + signature verification
- Configure backups and monitoring
- Add legally reviewed Terms/Privacy/Returns/Seller policies
- Security test the deployed environment

## Never share
Do not send passwords, API keys, payment secrets, database passwords or server
credentials in chat.


## Authentication hardening completed in v9
- [x] Server-side scrypt password hashing
- [x] Timing-safe password verification
- [x] OTP challenge table
- [x] OTP expiry (5 min)
- [x] OTP attempt limit
- [x] OTP verification
- [x] Account recovery request endpoint
- [x] No account enumeration in recovery response
- [x] Dev OTP can only be exposed when explicitly enabled
- [ ] Connect real SMS provider
- [ ] Connect real transactional email provider
- [ ] Set strong random PASSWORD_PEPPER / OTP_PEPPER / SESSION_SECRET
- [ ] Run production database migrations on PostgreSQL
