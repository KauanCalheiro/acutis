FROM php:8.5-cli
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip gosu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
