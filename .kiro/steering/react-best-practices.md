# React Best Practices (Vercel)

Based on Vercel's React Best Practices framework (v1.0.0). Contains 40+ rules across 8 categories, prioritized by impact.

## Priority Order

1. **CRITICAL**: Eliminating Waterfalls, Bundle Size Optimization
2. **HIGH**: Server-Side Performance
3. **MEDIUM-HIGH**: Client-Side Data Fetching
4. **MEDIUM**: Re-render Optimization, Rendering Performance
5. **LOW-MEDIUM**: JavaScript Performance
6. **LOW**: Advanced Patterns

---

## 1. Eliminating Waterfalls (CRITICAL)

### 1.1 Defer Await Until Needed
Move `await` into branches where actually used:

```typescript
// ❌ Bad: blocks both branches
async function handleRequest(userId: string, skip: boolean) {
  const data = await fetchData(userId)
  if (skip) return { skipped: true }
  return processData(data)
}

// ✅ Good: only blocks when needed
async function handleRequest(userId: string, skip: boolean) {
  if (skip) return { skipped: true }
  const data = await fetchData(userId)
  return processData(data)
}
```

### 1.2 Promise.all() for Independent Operations
```typescript
// ❌ Bad: sequential (3 round trips)
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// ✅ Good: parallel (1 round trip)
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### 1.3 Start Promises Early
```typescript
// ❌ Bad: config waits for auth
const session = await auth()
const config = await fetchConfig()

// ✅ Good: start both immediately
const sessionPromise = auth()
const configPromise = fetchConfig()
const session = await sessionPromise
const config = await configPromise
```

---

## 2. Bundle Size Optimization (CRITICAL)

### 2.1 Avoid Barrel File Imports
```typescript
// ❌ Bad: imports entire library (1,583 modules)
import { Check, X, Menu } from 'lucide-react'

// ✅ Good: direct imports (3 modules)
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
```

### 2.2 Dynamic Imports for Heavy Components
```typescript
// ❌ Bad: bundles with main chunk
import { HeavyEditor } from './heavy-editor'

// ✅ Good: loads on demand
const HeavyEditor = lazy(() => import('./heavy-editor'))
```

### 2.3 Defer Non-Critical Libraries
```typescript
// ❌ Bad: blocks initial bundle
import { Analytics } from '@vercel/analytics/react'

// ✅ Good: loads after hydration
const Analytics = lazy(() => 
  import('@vercel/analytics/react').then(m => ({ default: m.Analytics }))
)
```

### 2.4 Preload on User Intent
```typescript
function EditorButton({ onClick }) {
  const preload = () => void import('./heavy-editor')
  
  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  )
}
```

---

## 3. Client-Side Data Fetching (MEDIUM-HIGH)

### 3.1 Use React Query/SWR for Deduplication
Already implemented in this project via `@tanstack/react-query`.

### 3.2 Passive Event Listeners
```typescript
// ❌ Bad: blocks scrolling
element.addEventListener('scroll', handler)

// ✅ Good: non-blocking
element.addEventListener('scroll', handler, { passive: true })
```

### 3.3 Version localStorage Data
```typescript
const STORAGE_VERSION = 1
const data = JSON.parse(localStorage.getItem('key') || '{}')
if (data.version !== STORAGE_VERSION) {
  // Migration logic
}
```

---

## 4. Re-render Optimization (MEDIUM)

### 4.1 Use Lazy State Initialization
```typescript
// ❌ Bad: parses on every render
const [state, setState] = useState(JSON.parse(localStorage.getItem('key')))

// ✅ Good: parses once
const [state, setState] = useState(() => JSON.parse(localStorage.getItem('key')))
```

### 4.2 Use Functional setState
```typescript
// ❌ Bad: stale closure risk
setCount(count + 1)

// ✅ Good: always current
setCount(prev => prev + 1)
```

### 4.3 Narrow Effect Dependencies
```typescript
// ❌ Bad: runs on any user change
useEffect(() => {
  fetchData(user.id)
}, [user])

// ✅ Good: runs only when id changes
useEffect(() => {
  fetchData(user.id)
}, [user.id])
```

### 4.4 Extract to Memoized Components
```typescript
// ❌ Bad: re-renders on parent state change
function Parent() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <ExpensiveList items={items} />
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
    </div>
  )
}

// ✅ Good: memoized
const ExpensiveList = memo(({ items }) => (
  <ul>{items.map(item => <li key={item.id}>{item.name}</li>)}</ul>
))
```

### 4.5 Use Transitions for Non-Urgent Updates
```typescript
import { useTransition } from 'react'

function Search() {
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState('')
  
  const handleChange = (e) => {
    startTransition(() => setQuery(e.target.value))
  }
}
```

---

## 5. JavaScript Performance (LOW-MEDIUM)

### 5.1 Build Index Maps for Repeated Lookups
```typescript
// ❌ Bad: O(n) per lookup
users.find(u => u.id === id)

// ✅ Good: O(1) lookup
const userMap = new Map(users.map(u => [u.id, u]))
userMap.get(id)
```

### 5.2 Combine Multiple Array Iterations
```typescript
// ❌ Bad: 3 iterations
const active = users.filter(u => u.active)
const names = active.map(u => u.name)
const sorted = names.sort()

// ✅ Good: 1 iteration + sort
const sorted = users
  .reduce((acc, u) => {
    if (u.active) acc.push(u.name)
    return acc
  }, [])
  .sort()
```

### 5.3 Early Return from Functions
```typescript
// ❌ Bad: nested conditions
function process(data) {
  if (data) {
    if (data.valid) {
      return doWork(data)
    }
  }
  return null
}

// ✅ Good: early returns
function process(data) {
  if (!data) return null
  if (!data.valid) return null
  return doWork(data)
}
```

### 5.4 Use Set/Map for O(1) Lookups
```typescript
// ❌ Bad: O(n)
const exists = array.includes(item)

// ✅ Good: O(1)
const set = new Set(array)
const exists = set.has(item)
```

### 5.5 Hoist RegExp Creation
```typescript
// ❌ Bad: creates regex on every call
function validate(input) {
  return /^[a-z]+$/.test(input)
}

// ✅ Good: create once
const ALPHA_REGEX = /^[a-z]+$/
function validate(input) {
  return ALPHA_REGEX.test(input)
}
```

---

## 6. Rendering Performance (MEDIUM)

### 6.1 CSS content-visibility for Long Lists
```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 50px;
}
```

### 6.2 Hoist Static JSX Elements
```typescript
// ❌ Bad: recreates on every render
function Component() {
  return <div><StaticHeader /><DynamicContent /></div>
}

// ✅ Good: hoisted
const staticHeader = <StaticHeader />
function Component() {
  return <div>{staticHeader}<DynamicContent /></div>
}
```

### 6.3 Use Explicit Conditional Rendering
```typescript
// ❌ Bad: can render "0" or "false"
{count && <Component />}

// ✅ Good: explicit boolean
{count > 0 && <Component />}
{Boolean(count) && <Component />}
```

---

## Project-Specific Recommendations

### Implemented ✅
- Lazy loading pages with `React.lazy()`
- React Query for data fetching/caching
- Memoized components (`memo()`)
- Optimistic updates
- Debounced search
- Manual chunk splitting in Vite config
- Analytics lazy-loaded (deferred after hydration)
- `useTransition` for search operations (Friends page)
- Lazy state initialization (StudyTimer localStorage)
- CSS `content-visibility` for long lists
- Preloading on hover for Analytics component
- Server-side: Outbox pattern, caching, compression

### Consider for Future 🔧
1. Direct lucide-react imports for further bundle optimization
2. Add more preloading for other heavy components
3. Implement `useDeferredValue` for expensive renders
