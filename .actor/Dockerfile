# syntax=docker/dockerfile:1
FROM apify/actor-node:22

COPY package*.json ./

RUN npm --quiet set progress=false \
  && npm install --omit=dev --omit=optional \
  && (npm list --omit=dev --all || true)

COPY . ./

RUN npm run build

CMD npm run -s start --silent
