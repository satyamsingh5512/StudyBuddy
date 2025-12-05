# Database Setup Guide

## The Issue

You're getting the error: **"Can't reach database server at localhost:5432"**

This means PostgreSQL is not running on your system.

## Quick Fix Options

### Option 1: Start PostgreSQL (If Already Installed)

**On Linux:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Auto-start on boot
```

**On macOS:**
```bash
brew services start postgresql@14
```

**On Windows:**
- Open Services (Win + R, type `services.msc`)
- Find "PostgreSQL" service
- Click "Start"

### Option 2: Install PostgreSQL

**On Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**On macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**On Windows:**
- Download from: https://www.postgresql.org/download/windows/
- Run installer
- Start PostgreSQL service

### Option 3: Use Docker (Easiest)

```bash
# Pull and run PostgreSQL in Docker
docker run --name studybuddy-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=user \
  -e POSTGRES_DB=studybuddy \
  -p 5432:5432 \
  -d postgres:14

# Check if running
docker ps
```

### Option 4: Use Online Database (Production)

Use a cloud database service:

**Supabase (Free):**
1. Go to https://supabase.com
2. Create new project
3. Get connection string
4. Update .env:
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
```

**Neon (Free):**
1. Go to https://neon.tech
2. Create new project
3. Copy connection string
4. Update .env

**Railway (Free):**
1. Go to https://railway.app
2. Create PostgreSQL database
3. Copy connection string
4. Update .env

## After Database is Running

1. **Test connection:**
```bash
npx prisma db push
```

2. **Run migrations:**
```bash
./migrate-all.sh
```

3. **Start development server:**
```bash
npm run dev
```

## Verify Database

Open Prisma Studio to view your database:
```bash
npx prisma studio
```

This will open http://localhost:5555 with a GUI for your database.

## Current Database Configuration

Your `.env` file has:
```
DATABASE_URL="postgresql://user:password@localhost:5432/studybuddy"
```

Make sure:
- PostgreSQL is running on port 5432
- Database "studybuddy" exists
- User "user" with password "password" exists

## Create Database and User (If Needed)

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user
CREATE USER user WITH PASSWORD 'password';

# Create database
CREATE DATABASE studybuddy;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE studybuddy TO user;

# Exit
\q
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5432
sudo lsof -i :5432

# Or use different port in .env
DATABASE_URL="postgresql://user:password@localhost:5433/studybuddy"
```

### Permission Denied
```bash
# Fix PostgreSQL permissions
sudo chmod 755 /var/run/postgresql
```

### Connection Refused
- Check if PostgreSQL is running: `sudo systemctl status postgresql`
- Check firewall settings
- Verify DATABASE_URL is correct

## Need Help?

1. Check PostgreSQL logs: `sudo journalctl -u postgresql`
2. Test connection: `psql -U user -d studybuddy -h localhost`
3. Verify port: `sudo netstat -tlnp | grep 5432`
