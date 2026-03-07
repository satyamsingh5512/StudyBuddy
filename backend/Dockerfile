# Use official Go image for building
FROM golang:1.24.0-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o studybuddy-api main.go

# Use a minimal alpine image for the final container
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder
COPY --from=builder /app/studybuddy-api .

# Expose port (ensure it matches the port the app uses)
EXPOSE 8080

# Command to run the application
CMD ["./studybuddy-api"]
