# Tracker App - Backend (API & Telematics Server)

High-performance Express.js, MongoDB Atlas (Mongoose), and WebSocket 4.0 Telematics Server for Live GPS Tracking and OwnTracks ingestion.

## Features
- **MongoDB Atlas Integration**: Automated collection seeding (`User`, `Vehicle`, `Alert`, `TollPlaza`, `SupplyHub`).
- **JWT Authentication & RBAC**: Restricted login endpoint (`/api/auth/login`) with `girishubhranshu3@gmail.com` / `User@123`.
- **OwnTracks Webhook**: Ingestion endpoint at `/api/owntracks`.
- **Live WebSocket Feed**: Real-time push updates on `ws://localhost:5001`.
- **In-Memory Fallback**: Seamless development even before remote database password configuration.

## Setup & Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Environment configuration:
   Create a `.env` file based on `.env.example`:
   ```env
   PORT=5001
   CLIENT_URL=http://localhost:5173
   JWT_SECRET=fleetpro_super_secret_jwt_key_2026_xyz987
   JWT_EXPIRE=30d
   MONGODB_URI=mongodb+srv://girishubhranshu1_db_user:<your_password>@cluster0.anxdyt4.mongodb.net/tracker_db?retryWrites=true&w=majority&appName=Cluster0
   ```

3. Start server:
   ```bash
   npm run dev
   ```

## Push as Separate GitHub Repository

To push this backend folder as its own standalone GitHub repository:

```bash
cd backend
git init
git add .
git commit -m "Initial backend release"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_BACKEND_REPO>.git
git push -u origin main
```
