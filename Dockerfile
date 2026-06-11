FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
ENV OPEN_BROWSER=0
ENV PORT=8080

EXPOSE 8080

# User accounts + company sync JSON files (mount a volume here in production)
RUN mkdir -p /app/data

CMD ["node", "server.mjs"]
