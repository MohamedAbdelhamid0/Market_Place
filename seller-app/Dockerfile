FROM node:20-alpine
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Install nginx and use it to serve the built app
RUN apk add --no-cache nginx
COPY nginx.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /usr/share/nginx/html && cp -r dist/* /usr/share/nginx/html/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
