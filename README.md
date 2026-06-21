# TourGo API Service

API service for TourGo mobile application built with Node.js, Express, and Supabase.

## Features

- RESTful API endpoints
- JWT authentication with Supabase
- Role-based authorization
- Error handling middleware
- CORS enabled

## Tech Stack

- Node.js
- Express.js
- Supabase (Database + Auth)
- dotenv

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh-token
- POST /api/auth/logout

### Hotels
- GET /api/hotels
- GET /api/hotels/search?q=keyword
- GET /api/hotels/:id

### Tours
- GET /api/tours
- GET /api/tours/search?q=keyword
- GET /api/tours/filter?region=X
- GET /api/tours/:id

### Bookings (Protected)
- POST /api/bookings
- GET /api/bookings
- GET /api/bookings/:id
- PATCH /api/bookings/:id/cancel

### Favorites (Protected)
- GET /api/favorites
- POST /api/favorites
- DELETE /api/favorites/:id

### Hotel Reviews
- GET /api/hotel-reviews?hotelId=X
- POST /api/hotel-reviews (Protected)
- PATCH /api/hotel-reviews/:id (Protected)
- DELETE /api/hotel-reviews/:id (Protected)

### Users
- GET /api/users (Admin only)
- GET /api/users/me (Protected)
- PUT /api/users/me (Protected)
- DELETE /api/users/me (Protected)

## Environment Variables

```
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Local Development

```bash
npm install
npm run dev
```

## Production

```bash
npm start
```
