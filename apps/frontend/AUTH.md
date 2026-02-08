# Authentication System

## Overview

The Matrummet frontend uses JWT-based authentication with httpOnly cookies for secure session management.

## Architecture

### Components

1. **lib/auth.ts** - JWT utilities using jose library
   - `signToken()` - Sign JWT with HS256, 7 day expiry
   - `verifyToken()` - Verify and decode JWT
   - `getSession()` - Get current session from cookies (server-side)

2. **API Routes** (`app/api/auth/`)
   - `POST /api/auth/login` - Login with email and password
   - `POST /api/auth/registrera` - Register new user
   - `POST /api/auth/logout` - Clear auth cookie
   - `GET /api/auth/me` - Get current user session

3. **Client Components**
   - `components/auth-provider.tsx` - AuthContext provider with hooks
   - `components/login-form.tsx` - Login form
   - `components/signup-form.tsx` - Registration form

4. **Pages** (`app/(auth)/`)
   - `/login` - Login page
   - `/registrera` - Registration page

## Usage

### Client-Side (Use Auth Hook)

```tsx
'use client'

import { useAuth } from '@/components/auth-provider'

function MyComponent() {
  const { user, isLoading, login, logout } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Not logged in</div>
  }

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}
```

### Server-Side (Use getSession)

```tsx
// app/my-page/page.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function MyPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div>
      <h1>Welcome, {session.name}!</h1>
      <p>Email: {session.email}</p>
    </div>
  )
}
```

### Protected API Routes

```tsx
// app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Use session.email for PostgREST Authorization header
  const response = await fetch('http://localhost:4444/recipes', {
    headers: {
      'Authorization': `Bearer ${yourJWT}`,
    },
  })

  return NextResponse.json(await response.json())
}
```

## PostgREST Integration

The authentication flow integrates with PostgREST:

1. **Login/Signup** - Calls PostgREST `/rpc/login` or `/rpc/signup`
2. **JWT Generation** - Signs a new JWT with user's email and name
3. **Cookie Storage** - Stores JWT in httpOnly cookie
4. **API Requests** - Use session email to create PostgREST JWT

## Environment Variables

Required in `.env.local`:

```bash
# PostgREST API URL
POSTGREST_URL=http://localhost:4444

# JWT Secret (minimum 32 characters for HS256)
JWT_SECRET=your-secret-key-min-256-bits-long-for-hs256
```

## Security Features

- **httpOnly cookies** - Prevents XSS attacks
- **Secure flag** - HTTPS only in production
- **SameSite=lax** - CSRF protection
- **7-day expiry** - Automatic session timeout
- **Password requirements** - Enforced by backend (min 8 chars, uppercase, lowercase, number)

## Swedish UI

All user-facing text is in Swedish:
- "Logga in" - Login
- "Registrera" - Register
- "Lösenord" - Password
- "E-post" - Email
- Error messages in Swedish

## Testing

1. Start PostgREST: `./start-postgrest.sh`
2. Start frontend: `pnpm dev`
3. Navigate to `http://localhost:3000/registrera`
4. Create an account
5. Login at `http://localhost:3000/login`
