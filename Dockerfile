# FLOCH BOT — image produksi. Butuh Node >= 22.13 (node:sqlite bawaan).
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
# DATA_DIR WAJIB di volume/disk persisten, kalau tidak sesi WhatsApp hilang tiap restart.
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["npm", "start"]
