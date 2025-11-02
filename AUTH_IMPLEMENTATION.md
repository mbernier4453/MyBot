# Authentication System - Implementation Guide

## ✅ DECISION: Using Supabase Auth

**Status**: Proceeding with Supabase for authentication (third-party managed auth)

### Why Supabase?
- Enterprise-grade security out of the box
- No need to build/maintain backend auth system
- Free tier: 50,000 monthly active users
- Built-in features: email verification, password reset, social OAuth, MFA
- Automatic session management and JWT handling

---

## Current Status: FRONTEND ONLY (No Backend)

The current authentication is **completely frontend-only** and has **NO security**. It redirects to `/app` without any validation.

### What's NOT Implemented:
- ❌ No user database
- ❌ No password hashing
- ❌ No session management
- ❌ No JWT tokens
- ❌ No API endpoints
- ❌ No email verification
- ❌ No password reset

### Current Flow:
```
User submits form → auth.js validates form → redirects to /app
```

**Data Storage: NONE** - Everything is lost on page refresh.

---

## Recommended Implementation (Scalable)

### Architecture Options:

#### Option 1: Simple File-Based (Quick Start)
```
Users stored in: JSON file or SQLite database
Sessions: In-memory or Redis
Security: bcrypt password hashing
Scalability: 1-100 users
```

#### Option 2: Production-Ready (Recommended)
```
Database: PostgreSQL
Authentication: JWT tokens + refresh tokens
Password Security: bcrypt + salt
Session Storage: Redis
Email Service: SendGrid or AWS SES
Scalability: Unlimited
```

#### Option 3: Third-Party Auth (Easiest)
```
Provider: Auth0, Firebase Auth, Supabase, or Clerk
Benefits: 
  - No backend auth code needed
  - Built-in security
  - Social logins (Google, GitHub, etc.)
  - Email verification
  - Password reset
Scalability: Unlimited
Cost: Free tier → $25-100/month
```

---

## Implementation Plan

### Phase 1: Backend API Setup
Create Flask authentication endpoints in `backend/app.py`:

```python
# Required endpoints:
POST /api/auth/register
  - Input: { name, email, password }
  - Output: { user_id, token }
  
POST /api/auth/login
  - Input: { email, password }
  - Output: { user_id, token, refresh_token }
  
POST /api/auth/logout
  - Input: { token }
  - Output: { success }
  
GET /api/auth/verify
  - Input: { token }
  - Output: { user_id, email, name }
```

### Phase 2: Database Schema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token VARCHAR(512) NOT NULL,
  refresh_token VARCHAR(512),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Phase 3: Frontend Updates
- Store JWT token in localStorage or httpOnly cookie
- Add Authorization header to all API requests
- Add token refresh logic
- Protect routes with auth check
- Add logout functionality

### Phase 4: Security Features
- Password strength requirements
- Rate limiting on login attempts
- Email verification
- Password reset flow
- 2FA (optional)

---

## Quick Start with Third-Party (Recommended)

### Using Supabase (Free Tier):
```javascript
// Install: npm install @supabase/supabase-js

// Initialize
import { createClient } from '@supabase/supabase-js'
const supabase = createClient('YOUR_URL', 'YOUR_KEY')

// Sign Up
const { data, error } = await supabase.auth.signUp({
  email: 'user@email.com',
  password: 'password123'
})

// Sign In
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@email.com',
  password: 'password123'
})

// Get Session
const { data: { session } } = await supabase.auth.getSession()

// Protected API Calls
const { data } = await supabase
  .from('user_data')
  .select('*')
  .eq('user_id', session.user.id)
```

Setup time: **30 minutes**
Cost: **Free** for 50,000 monthly active users

---

## Files to Modify

### For Backend Implementation:
1. `backend/app.py` - Add auth endpoints
2. `backend/auth.py` - Create authentication logic
3. `backend/models.py` - Add User model
4. `backend/requirements.txt` - Add: PyJWT, bcrypt, python-dotenv

### For Frontend:
1. `frontend/auth.js` - Update to call real API
2. `frontend/config.js` - Add API endpoint configuration
3. Create `frontend/utils/auth.js` - Token management utilities
4. Update `frontend/server.js` - Add session middleware

---

## Supabase Implementation Steps

### 1. Setup Supabase Project (5 minutes)
1. Go to https://supabase.com
2. Create account and new project
3. Copy your project URL and anon key from Settings > API

### 2. Install Supabase Client (1 minute)
```bash
cd frontend
npm install @supabase/supabase-js
```

### 3. Update Frontend Code (15 minutes)

**Create `frontend/utils/supabase.js`:**
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Update `frontend/auth.js`:**
```javascript
import { supabase } from './utils/supabase.js'

async function handleSignUp(event) {
  event.preventDefault()
  const email = document.getElementById('signup-email').value
  const password = document.getElementById('signup-password').value
  
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    alert(error.message)
  } else {
    window.location.href = '/app'
  }
}

async function handleSignIn(event) {
  event.preventDefault()
  const email = document.getElementById('signin-email').value
  const password = document.getElementById('signin-password').value
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    alert(error.message)
  } else {
    window.location.href = '/app'
  }
}

async function handleSignOut() {
  await supabase.auth.signOut()
  window.location.href = '/'
}
```

**Add route protection in `frontend/index.html`:**
```javascript
import { supabase } from './utils/supabase.js'

// Check auth on page load
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    window.location.href = '/'
  }
})
```

### 4. Configure Supabase (5 minutes)
1. In Supabase Dashboard > Authentication > URL Configuration
2. Set Site URL: `http://138.197.6.220/app`
3. Add Redirect URLs: `http://138.197.6.220/app`
4. Enable email confirmations (optional)

### 5. Deploy and Test
```bash
git add .
git commit -m "Integrate Supabase Auth"
git push origin server-version
ssh root@138.197.6.220 "cd /var/www/alpharhythm && git pull && npm install && sudo systemctl restart alpharhythm"
```

---

## Security Checklist (Supabase handles most of these)

**Automatically handled by Supabase:**
- ✅ Passwords hashed with bcrypt
- ✅ JWT token generation and validation
- ✅ Session management
- ✅ Rate limiting
- ✅ Email verification
- ✅ Password reset flow
- ✅ SQL injection prevention
- ✅ XSS protection

**You still need to implement:**
- [ ] HTTPS enabled (configure nginx with SSL certificate)
- [ ] Protected routes on frontend (check session before rendering)
- [ ] CORS properly configured in backend
- [ ] Environment variables for Supabase keys (don't commit to git)
