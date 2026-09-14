# Use official Go image for building
FROM golang:1.24.0-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o studybuddy-api main.go

# Use a minimal alpine image for the final container
# (ca-certificates is required for TLS to MongoDB Atlas / Cosmos DB on Azure)
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -H -u 10001 appuser

WORKDIR /app

# Copy the binary from the builder
COPY --from=builder /app/studybuddy-api .

# Azure App Service for Containers routes to WEBSITES_PORT.
# The Go app reads PORT, then WEBSITES_PORT, then 8080 (see main.go).
# Keep 8080 as the default so F1 Free works with WEBSITES_PORT=8080.
EXPOSE 8080

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-8080}/api/health/live || exit 1

# Command to run the application
CMD ["./studybuddy-api"]
