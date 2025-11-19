# Database Setup Guide

You need a PostgreSQL database to run StudyBuddy. Choose one option:

## Option 1: Neon (Recommended - Easiest)

**Why Neon?**
- ✅ Free tier available
- ✅ No local installation needed
- ✅ Works immediately
- ✅ Includes connection pooling

**Steps:**

1. Go to [neon.tech](https://neon.tech)
2. Sign up with Google (free)
3. Click "Create Project"
4. Copy the connection string (looks like this):
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Update `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```
6. Run:
   ```bash
   npm run db:push
   ```

**Done!** ✅

## Option 2: Local PostgreSQL

**Requirements:**
- PostgreSQL installed on your machine

**Steps:**

### Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS (with Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### Create Database

```bash
# Switch to postgres user (Linux/Mac)
sudo -u postgres psql

# Or just run (if postgres user is set up)
psql postgres

# In psql console:
CREATE DATABASE studybuddy;
CREATE USER studybuddy_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE studybuddy TO studybuddy_user;
\q
```

### Update .env

```env
DATABASE_URL="postgresql://studybuddy_user:your_password@localhost:5432/studybuddy"
```

### Push Schema

```bash
npm run db:push
```

## Option 3: Docker PostgreSQL

**Quick setup with Docker:**

```bash
docker run --name studybuddy-db \
  -e POSTGRES_PASSWORD=studybuddy123 \
  -e POSTGRES_USER=studybuddy \
  -e POSTGRES_DB=studybuddy \
  -p 5432:5432 \
  -d postgres:16-alpine
```

**Update .env:**
```env
DATABASE_URL="postgresql://studybuddy:studybuddy123@localhost:5432/studybuddy"
```

**Push schema:**
```bash
npm run db:push
```

## Verify Database Connection

After setting up, run:

```bash
npm run check
```

You should see:
```
✅ Database URL
```

Then run:
```bash
npm run db:push
```

You should see:
```
✔ Generated Prisma Client
Your database is now in sync with your Prisma schema.
```

## Troubleshooting

### "Can't reach database server"

**Neon:**
- Check if connection string is correct
- Ensure `?sslmode=require` is at the end

**Local:**
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Verify port 5432 is not blocked
- Check username/password are correct

### "Database does not exist"

Create the database first:
```bash
createdb studybuddy
```

### "Permission denied"

Grant proper permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE studybuddy TO your_user;
```

## Next Steps

Once database is set up:

1. ✅ Run `npm run check` - should show all green
2. ✅ Run `npm run dev` - start the app
3. ✅ Open http://localhost:5173 - see the landing page
4. ✅ Click "Get Started" - sign in with Google

Happy coding! 🚀
