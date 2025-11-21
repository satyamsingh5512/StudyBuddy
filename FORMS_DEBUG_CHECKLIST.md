# Forms Section Debug Checklist

## Issue: Forms section not working - only buttons showing

### Step 1: Check if you're logged in
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `document.cookie`
4. Look for `connect.sid` cookie - if missing, you're not logged in

### Step 2: Check API calls
1. Go to Network tab in DevTools
2. Navigate to `/forms`
3. Look for these API calls:
   - `GET /api/auth/me` - should return 200 with user data
   - `GET /api/forms?archived=false` - should return 200 with forms array
   
### Step 3: Check for errors
Look in Console for these specific errors:

**If you see "401 Unauthorized":**
- You're not logged in
- Solution: Click "Sign in with Google"

**If you see "404 Not Found on /api/forms":**
- Backend routes not registered
- Check if server is running on port 3001

**If you see "Failed to fetch" or "Network Error":**
- Backend server is not running
- Solution: Run `npm run dev` in terminal

**If you see "CORS error":**
- Check `CLIENT_URL` environment variable
- Should be `http://localhost:5173` for local dev

### Step 4: Test backend directly
Open new terminal and run:
```bash
# Test if server is running
curl http://localhost:3001/api/health

# Test forms endpoint (will fail if not logged in, but should return 401 not 404)
curl -X GET http://localhost:3001/api/forms
```

### Step 5: Check environment variables
```bash
# In project root
cat .env

# Should have:
DATABASE_URL=postgresql://...
SESSION_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Step 6: Check database connection
```bash
# In project root
npx prisma studio

# This should open Prisma Studio at http://localhost:5555
# Check if Form table exists and has data
```

### Common Issues & Solutions

#### Issue: Buttons show but no forms
**Cause**: Not logged in OR no forms created yet
**Solution**: 
1. Check if logged in (see Step 1)
2. Try creating a new form by clicking "Create Form" button

#### Issue: "Create Form" button does nothing
**Cause**: JavaScript error or API not responding
**Solution**:
1. Check Console for errors
2. Check Network tab for failed API call
3. Look for `POST /api/forms` request

#### Issue: Edit button redirects to dashboard immediately
**Cause**: Form load failing (404 or 401)
**Solution**:
1. Check Console logs (we added detailed logging)
2. Look for "Load form response: XXX" message
3. Check the error message in toast notification

#### Issue: Forms list is empty but you know you have forms
**Cause**: Database issue or user ownership mismatch
**Solution**:
1. Open Prisma Studio: `npx prisma studio`
2. Check Form table
3. Verify `ownerId` matches your user ID
4. Check Users table to confirm your ID

### Quick Test Script
Run this in browser console when on `/forms` page:

```javascript
// Test if user is authenticated
fetch('/api/auth/me', {credentials: 'include'})
  .then(r => r.json())
  .then(d => console.log('User:', d))
  .catch(e => console.error('Auth failed:', e));

// Test forms API
fetch('/api/forms?archived=false', {credentials: 'include'})
  .then(r => r.json())
  .then(d => console.log('Forms:', d))
  .catch(e => console.error('Forms failed:', e));
```

### Expected Console Output (Working State)
```
User: {id: "xxx", email: "xxx@gmail.com", name: "Your Name", ...}
Forms: [{id: "xxx", title: "Form 1", ...}, ...]
```

### Expected Console Output (Not Working)
```
Auth failed: TypeError: Failed to fetch
OR
User: {error: "Not authenticated"}
OR
Forms failed: TypeError: Failed to fetch
```

---

## Still not working?

### Check these files exist:
- ✅ `server/routes/forms.ts`
- ✅ `server/routes/formFields.ts`
- ✅ `server/routes/formSections.ts`
- ✅ `server/index.ts` (should import and register routes)

### Check server/index.ts has these lines:
```typescript
import formsRoutes from './routes/forms';
import formFieldsRoutes from './routes/formFields';
import formSectionsRoutes from './routes/formSections';

app.use('/api/forms', formsRoutes);
app.use('/api/form-fields', formFieldsRoutes);
app.use('/api/form-sections', formSectionsRoutes);
```

### Nuclear option (if nothing else works):
```bash
# Stop all processes
pkill -f tsx
pkill -f node

# Clean everything
rm -rf node_modules
rm -rf dist
rm -rf dist-server
rm package-lock.json

# Reinstall
npm install

# Regenerate Prisma
npx prisma generate

# Start fresh
npm run dev
```
