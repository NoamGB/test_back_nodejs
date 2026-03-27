FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

EXPOSE 3000

# Default command (can be overridden by docker-compose)
CMD ["npm", "run", "start"]

