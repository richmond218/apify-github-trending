# syntax=docker/dockerfile:1
FROM apify/actor-node:22

COPY package*.json ./

RUN npm --quiet set progress=false \
  && npm install --include=dev \
  && (npm list --all || true)

COPY . ./

RUN npm run build \
  && npm prune --omit=dev --omit=optional

CMD npm run -s start --silent
