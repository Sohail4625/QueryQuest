FROM node:18-slim

RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libxshmfence1 \
  libnss3 \
  libnspr4 \
  libgbm1 \
  libpango-1.0-0 \
  libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*
  
RUN  npx puppeteer browsers install chrome

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . /app

CMD ["node", "index.js"]
