FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && node -e "for (const dependency of ['compression', 'cors', 'dotenv', 'express', 'express-rate-limit', 'helmet', 'morgan', 'pg', 'pino', 'prom-client', 'zod']) require.resolve(dependency)" \
    && npm cache clean --force
COPY config.js logger.js monitoring.js server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
