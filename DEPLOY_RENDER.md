# Afghan Online Bazaar — Free Demo Deployment (Render)

This package is prepared for a Node/Express demo deployment on Render.

## 1) Upload the project
Create a Render account and choose **New + → Web Service**. Connect a GitHub repository containing this project.

## 2) Build settings
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Node: 20+

The included `render.yaml` can also be used with Render Blueprint deployment.

## 3) Environment variables
Set these server-side in Render:

- `NODE_ENV=production`
- `SESSION_SECRET` = a long random secret
- `PASSWORD_PEPPER` = a long random secret
- `OTP_PEPPER` = a long random secret
- `AOB_SHOW_DEV_OTP=false`

Do NOT put these secrets in the website, browser storage, or chat.

## 4) Demo URL
After deployment, Render assigns a free `*.onrender.com` URL. The exact URL is only known after Render finishes the deployment.

## 5) Test
Open the assigned URL and check:
- `/api/health`
- registration/login
- product catalog
- cart/order flow
- AI Assistant
- seller/admin areas

## Important demo limitation
The current v9 demo uses SQLite. On free cloud hosting, SQLite should be treated as demo storage and is not suitable for a production marketplace. Before a real launch, migrate to PostgreSQL and add backups.

## Production integrations still required
- PostgreSQL
- Real SMS/OTP provider
- Transactional email
- AI provider API key
- Payment gateway
- Afghanistan courier/delivery API
- Object storage/CDN for product images
- Domain and DNS
- Monitoring/backups
- Security review
