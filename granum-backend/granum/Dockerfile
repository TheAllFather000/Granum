FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

ENV NODE_ENV=production

CMD ["sh", "-c", "node src/scripts/migrate.js && node src/app.js"]