# SmartCart Pro - Auth + Payment + Order Tracking

## Features
- JWT login/register with bcrypt password hashing
- Admin and customer roles
- Product listing and admin product add/delete
- One-step secure demo checkout using `/api/checkout`
- Demo UPI, demo card, and Cash on Delivery
- Order creation, stock update, transaction ID
- Order tracking ID, estimated delivery, status timeline
- Admin tracking status update
- Docker Compose + MongoDB + Nginx reverse proxy

## Run
```powershell
docker compose down --volumes
docker compose up -d --build
```

Open:
```text
http://localhost:8080/?v=final
```

## Default Admin Login
```text
admin@smartcart.com
admin123
```

## Important
If you used an older version, clear browser localStorage once:
F12 -> Application -> Local Storage -> http://localhost:8080 -> Clear

This project uses a demo payment system only. No real money is charged.
