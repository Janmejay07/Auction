# Football Auction

A real-time football player auction application with a Next.js frontend, Express/Socket.IO backend, and MongoDB persistence.

## Project structure

- `backend/` - Express API, Socket.IO events, auction engine, MongoDB models, and tests
- `frontend/` - Next.js user interface
- `json/` - source competition/player data

## Local development

### Backend

```powershell
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:3000`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

Copy `backend/.env.example` to `backend/.env` and set local values. Copy the frontend environment values from `frontend/.env.local.example` if that file is available, or configure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` directly.

## Verification

```powershell
cd backend
npm test
npm run build

cd ../frontend
npm run build
```

## Deployment

Deploy the backend as a single Render Web Service and the frontend as a Vercel Next.js application. Use MongoDB Atlas for production because auction settlement uses MongoDB transactions. Configure production environment variables in the hosting dashboards; do not commit `.env` files.
