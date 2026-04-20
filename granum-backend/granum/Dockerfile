FROM node:20-alpine

WORKDIR /app

# install deps first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev && npm install --save-dev nodemon

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
