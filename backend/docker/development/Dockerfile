FROM mcr.microsoft.com/playwright:v1.61.1-noble
RUN npm install -g pnpm@11.9.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
