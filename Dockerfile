FROM node:22-alpine

ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY package.json package-lock.json ./
# Tasked only uses Firebase Admin Auth (the database is Postgres). Omit the
# SDK's optional Firestore/Storage clients so unused cloud-service dependency
# trees do not ship in the production image.
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

COPY --chown=node:node server.js ./server.js
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public

# VPN backup profiles contain private connection credentials. Refuse to build
# if one is ever accidentally copied into the publicly served asset tree.
RUN if find /app/public -type f -iname '*backup*profile*' -print -quit | grep -q .; then \
      echo 'Refusing to bundle a backup profile in public assets' >&2; exit 1; \
    fi
RUN if find /app/public \( -name '._*' -o -name '.DS_Store' \) -print -quit | grep -q .; then \
      echo 'Refusing to bundle macOS metadata sidecars in public assets' >&2; exit 1; \
    fi

USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

