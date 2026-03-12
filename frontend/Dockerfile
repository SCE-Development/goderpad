# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY ../nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 7777

CMD ["nginx", "-g", "daemon off;"]