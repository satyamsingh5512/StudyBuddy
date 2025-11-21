# StudyBuddy Forms - Quick Access Guide

## 🌐 Local Development URLs

### Frontend (React + Vite)
- **URL:** http://localhost:5173/
- **Port:** 5173

### Backend (Express API)
- **URL:** http://localhost:3001/
- **Port:** 3001

---

## 📍 Navigation Guide

### 1. **Landing Page**
```
URL: http://localhost:5173/
```
- View features overview
- Click "Get Started" to sign in

### 2. **Authentication**
```
Google OAuth Login
```
- Click "Sign in with Google"
- Authorize with your Google account
- Redirects to dashboard after first login (onboarding)

### 3. **Forms Dashboard**
```
URL: http://localhost:5173/forms
```
**Features:**
- View all your forms
- Create new forms (6 templates available)
- See response counts
- Toggle accepting responses
- Archive/Delete forms
- Duplicate forms

### 4. **Form Builder**
```
URL: http://localhost:5173/forms/{formId}/builder
```
**Toolbar Buttons:**
- **Share** - Add collaborators with roles (Viewer/Editor/Admin)
- **Webhooks** - Configure webhook notifications
- **Settings** - Form title, description, colors, slug
- **Copy Link** - Get public form URL
- **Preview** - See how form looks to users
- **Save** - Save changes

**Sidebar:**
- Drag 12 field types into form
- Configure each field
- Add conditional logic
- Reorder with drag-and-drop

### 5. **Form Responses**
```
URL: http://localhost:5173/forms/{formId}/responses
```
**View:**
- All submitted responses
- Responder details
- Export to CSV
- Individual response details
- File attachments

### 6. **Form Analytics**
```
URL: http://localhost:5173/forms/{formId}/analytics
```
**Charts:**
- Response trends over time
- Field-specific analytics
- Multiple choice breakdowns
- Response rates

### 7. **Webhook Logs**
```
URL: http://localhost:5173/forms/{formId}/webhook-logs
```
**Monitor:**
- All webhook delivery attempts
- Success/failure status
- Response times
- Error messages
- Retry attempts (max 3)

### 8. **Public Form (Share with Others)**
```
URL: http://localhost:5173/forms/f/{formId}
OR
URL: http://localhost:5173/forms/f/{customSlug}
```
**Features:**
- No login required
- Responsive design
- File uploads (if enabled)
- Conditional fields
- Custom branding
- Success message

---

## 🔥 Quick Start Workflow

1. **Start Server:**
   ```bash
   npm run dev
   ```

2. **Open Browser:**
   ```
   http://localhost:5173/
   ```

3. **Sign In:**
   - Click "Get Started"
   - Sign in with Google

4. **Go to Forms:**
   - Click "Forms" in sidebar
   - Or go to: http://localhost:5173/forms

5. **Create First Form:**
   - Click "Create Form"
   - Choose "Customer Feedback" template
   - Edit fields as needed
   - Click "Save"

6. **Configure Webhooks:**
   - Click "Webhooks" button
   - Enter URL: https://webhook.site/your-unique-url
   - Click "Test Webhook"
   - Enable and save

7. **Share Form:**
   - Click "Share" button
   - Enter collaborator's email
   - Select role (Viewer/Editor/Admin)
   - Click "Invite"

8. **Test Public Form:**
   - Click "Copy Link"
   - Open in incognito/private window
   - Fill out and submit
   - Check responses in dashboard

9. **View Analytics:**
   - Go to form responses page
   - Click "Analytics" tab
   - See charts and trends

---

## 🎯 Available Form Templates

1. **Event Registration**
   - Name, Email, Phone, Event selection
   - Dietary preferences, Special requirements

2. **Customer Feedback**
   - Satisfaction rating, Comments
   - Service quality, Recommendations

3. **Job Application**
   - Personal info, Resume upload
   - Experience, Cover letter

4. **Course Enrollment**
   - Student details, Course selection
   - Prerequisites, Payment info

5. **Contact Form**
   - Name, Email, Subject
   - Message, Attachments

6. **Survey Template**
   - Demographics, Multiple choice
   - Ratings, Open-ended questions

---

## 🔧 Features to Test

### ✅ Form Builder
- [x] Drag-and-drop 12 field types
- [x] Conditional logic (show/hide fields)
- [x] File uploads (50MB limit)
- [x] Custom styling (colors, logo)
- [x] Custom URL slugs

### ✅ Webhooks
- [x] Configure webhook URL
- [x] Test endpoint
- [x] View delivery logs
- [x] Retry logic (3 attempts)
- [x] Event filtering

### ✅ Collaboration
- [x] Invite by email
- [x] 3 roles (Viewer/Editor/Admin)
- [x] Activity logs
- [x] Remove collaborators

### ✅ Analytics
- [x] Response trends chart
- [x] Field distribution charts
- [x] Export to CSV
- [x] Real-time updates

### ✅ Public Forms
- [x] No login required
- [x] Mobile responsive
- [x] Custom branding
- [x] File uploads
- [x] Success messages

---

## 🐛 Testing Webhooks

1. **Get Test URL:**
   - Go to https://webhook.site/
   - Copy your unique URL

2. **Configure in StudyBuddy:**
   - Open form builder
   - Click "Webhooks"
   - Paste URL
   - Click "Test Webhook"
   - Should see success message

3. **Submit Form Response:**
   - Copy public form link
   - Open in new tab
   - Fill and submit
   - Check webhook.site for payload

4. **View Logs:**
   - Click "View Logs" in webhook settings
   - See all delivery attempts
   - Check status codes and timing

---

## 📱 API Endpoints (for testing)

### Forms
```
GET    /api/forms                    - List all forms
POST   /api/forms                    - Create form
GET    /api/forms/:id                - Get form details
PATCH  /api/forms/:id                - Update form
DELETE /api/forms/:id                - Delete form
POST   /api/forms/:id/duplicate      - Duplicate form
```

### Webhooks
```
GET    /api/webhooks/:formId/config  - Get webhook config
PATCH  /api/webhooks/:formId/config  - Update config
POST   /api/webhooks/:formId/test    - Test webhook
GET    /api/webhooks/:formId/logs    - Get logs
```

### Collaboration
```
GET    /api/collaborators/:formId           - List collaborators
POST   /api/collaborators/:formId           - Add collaborator
PATCH  /api/collaborators/:formId/:userId   - Update role
DELETE /api/collaborators/:formId/:userId   - Remove
GET    /api/collaborators/:formId/activity  - Activity logs
```

---

## 🎉 Your Forms System is 100% Complete!

All features are working and production-ready. Enjoy testing! 🚀
