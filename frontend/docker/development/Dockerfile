FROM node:24-slim
RUN npm install -g pnpm@11.9.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
