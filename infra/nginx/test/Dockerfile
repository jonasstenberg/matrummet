FROM oven/bun:alpine AS bun
FROM nginx:alpine

# Copy bun binary from official image
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

RUN apk add --no-cache openssl

# Match production directory layout exactly
RUN mkdir -p \
    /etc/nginx/sites-enabled \
    /etc/nginx/snippets \
    /var/cache/nginx/matrummet \
    /opt/matrummet/public/uploads \
    /var/www/html \
    /home/jonas/.acme.sh/matrummet.se_ecc \
    /home/jonas/.acme.sh/mat.stenberg.io_ecc \
    /home/jonas/.acme.sh/api.matrummet.se_ecc

# Self-signed cert reused for all domains
RUN openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
      -keyout /tmp/test.key -out /tmp/test.cer \
      -subj "/CN=test" 2>/dev/null && \
    cp /tmp/test.cer /home/jonas/.acme.sh/matrummet.se_ecc/fullchain.cer && \
    cp /tmp/test.key /home/jonas/.acme.sh/matrummet.se_ecc/matrummet.se.key && \
    cp /tmp/test.cer /home/jonas/.acme.sh/mat.stenberg.io_ecc/fullchain.cer && \
    cp /tmp/test.key /home/jonas/.acme.sh/mat.stenberg.io_ecc/mat.stenberg.io.key && \
    cp /tmp/test.cer /home/jonas/.acme.sh/api.matrummet.se_ecc/fullchain.cer && \
    cp /tmp/test.key /home/jonas/.acme.sh/api.matrummet.se_ecc/api.matrummet.se.key && \
    rm /tmp/test.key /tmp/test.cer

# Snippet files (mapped to production names)
COPY shared-locations.conf  /etc/nginx/snippets/matrummet-locations.conf
COPY security-headers.conf  /etc/nginx/snippets/matrummet-security-headers.conf
COPY api-rpc-common.conf    /etc/nginx/snippets/matrummet-api-rpc.conf
COPY app-proxy-common.conf  /etc/nginx/snippets/matrummet-app-proxy.conf
COPY db-proxy-common.conf   /etc/nginx/snippets/matrummet-db-proxy.conf

# conf.d files
COPY proxy-cache.conf /etc/nginx/conf.d/proxy-cache.conf
COPY rate-limit.conf  /etc/nginx/conf.d/rate-limit.conf

# Site configs (unmodified production files)
COPY matrummet.conf /etc/nginx/sites-enabled/matrummet
COPY api.conf       /etc/nginx/sites-enabled/api.matrummet.se

# Remove default site, add test nginx.conf
RUN rm -f /etc/nginx/conf.d/default.conf
COPY test/nginx.conf /etc/nginx/nginx.conf

# Mock upstream + entrypoint
COPY test/mock-upstream.ts /mock-upstream.ts
COPY test/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Test file for /uploads/ static serving
RUN echo "test-upload-content" > /opt/matrummet/public/uploads/test.jpg

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
