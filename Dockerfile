# Node + Python in one image. Cloud Run/Cloud Build prefer a Dockerfile over
# buildpacks automatically when one exists at the repo root, so no trigger
# config changes are needed — just add this file.
FROM node:22-slim

# python3-venv isn't strictly required here (we use --break-system-packages
# instead of a venv, matching Debian 12's PEP 668 restriction), but keeping
# it available costs little and helps if you switch to a venv later.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node deps first (better layer caching — this layer only rebuilds when
# package.json/package-lock.json change, not on every source edit).
# npm ci (vs. install) installs exactly what's locked, for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Python deps — same caching reasoning
COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# Now the actual source
COPY . .

# esbuild's --packages=external (see package.json "build" script) means
# node_modules must stay present at runtime — this build step does NOT prune it.
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]