# Build stage
FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o goderpad ./cmd/server

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=build /app/goderpad .
COPY --from=build /app/config ./config

EXPOSE 7778

CMD ["./goderpad"]
