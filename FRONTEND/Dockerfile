FROM node:22-alpine AS client
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server ./
RUN npm run build
COPY --from=client /app/dist /app/dist
ENV NODE_ENV=production
EXPOSE 8787
CMD ["node","dist/src/index.js"]
