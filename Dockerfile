# ---------- Stage 1: bundle the app for production once (force amd64 to avoid wasm/qemu woes)
FROM denoland/deno:latest AS builder

ARG GIT_REVISION
ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}
ENV DENO_BUILD_STAGE=PRODUCTION

WORKDIR /app

COPY . .

WORKDIR /app/www

RUN deno task build

RUN deno cache --reload ./dist/compiled-entry.js

RUN deno task compile

# Production stage
FROM denoland/deno:latest

# Set working directory
WORKDIR /app

# Copy compiled binary from builder stage
COPY --from=builder /app/www/dist/bin/www /app/bin

CMD ["./bin/www"]





# ---------- Stage 1: bundle the app for production once (force amd64 to avoid wasm/qemu woes)
# FROM denoland/deno:latest

# ARG GIT_REVISION
# ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}

# WORKDIR /app

# COPY www/ .

# RUN deno cache --reload --unstable-raw-imports main.ts

# CMD ["deno", "task", "serve"]