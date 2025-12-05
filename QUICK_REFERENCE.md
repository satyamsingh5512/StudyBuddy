# Quick Reference Guide

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Setup database
./migrate-schedule.sh

# 3. Start development
npm run dev
```

## 📱 Responsive Breakpoints

```
xs:  475px  - Extra small phones
sm:  640px  - Phones
md:  768px  - Tablets
lg:  1024px - Desktops
xl:  1280px - Large desktops
```

## 🎨 Common Patterns

### Responsive Layout
```tsx
<div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
  <div className="w-full sm:w-1/2">Content</div>
</div>
```

### Smooth Transitions
```tsx
<button className="transition-all duration-200 hover:scale-105 active:scale-95">
  Click me
</button>
```

### Responsive Text
```tsx
<h1 className="text-xl sm:text-2xl md:text-3xl">
  Responsive Heading
</h1>
```

### Responsive Padding
```tsx
<div className="p-2 sm:p-4 md:p-6">
  Content with responsive padding
</div>
```

## 🔄 Server Keep-Alive

### Check Status
```typescript
import { getServerStatus } from '@/lib/serverWakeup';

const { isAwake, isWakingUp } = getServerStatus();
```

### Use Enhanced Fetch
```typescript
import { fetchWithWakeup } from '@/lib/serverWakeup';

const response = await fetchWithWakeup('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data)
});
```

## 🎯 Animation Classes

```css
/* Fade in on mount */
.page-transition

/* Loading shimmer */
.animate-shimmer

/* Slide up */
.animate-slide-up

/* Custom fade in up */
animation: fadeInUp 0.3s ease-out
```

## 📊 Key Features

### Schedule Page
- ✅ Fully responsive
- ✅ Smooth animations
- ✅ Touch-friendly
- ✅ Date filtering
- ✅ List view

### Layout
- ✅ Mobile menu
- ✅ Responsive sidebar
- ✅ Sticky headers
- ✅ Profile dropdown

### Server
- ✅ Auto keep-alive
- ✅ Cold start handling
- ✅ Retry logic
- ✅ Progress indicators

## 🐛 Common Issues

### Server sleeping?
- Check Render logs
- Verify RENDER_EXTERNAL_URL
- Ensure keep-alive is running

### Animations janky?
- Use transform instead of width/height
- Reduce animation duration
- Check for layout shifts

### Mobile menu not working?
- Clear browser cache
- Check z-index values
- Test on real device

## 📝 Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...

# Optional (Render)
RENDER_EXTERNAL_URL=https://your-app.onrender.com
NODE_ENV=production
```

## 🎉 That's It!

Your app is now:
- 📱 Fully responsive
- ⚡ Lightning fast
- 🎨 Beautifully animated
- 🔄 Always awake

Enjoy building! 🚀
