# VPS deployment layout

This file describes the currently documented topology, not a standalone deployment recipe.
The active VPS uses HAProxy as the only public TCP/443 listener. HAProxy routes the exact
`pix-study.duckdns.org` SNI name to Nginx on `127.0.0.1:9444`; Nginx terminates HTTPS and proxies
to the Tasked app on `127.0.0.1:3000`. Other TLS traffic must keep its existing routes and Xray
fallback. See [`ecosystem/domains/pix-hub-rollout.md`](../../ecosystem/domains/pix-hub-rollout.md)
for the reviewed live topology and change/rollback procedure.

The live certificate workflow is acme.sh with TLS-ALPN-01 through HAProxy. Public port 80 is
unavailable. Do not run Certbot HTTP-01/standalone commands, bind another process to public 443,
or replace the checked-in snippets directly: the certificate paths and proxy fragments here may
be historical templates and do not describe the current multi-service routes.

For a separately provisioned Tasked instance, the web container should bind only to loopback and
Nginx should terminate HTTPS on a private listener. Keep `.env` out of Git and Docker build
contexts; install fresh, rotated provider credentials there with mode 0600 before starting Compose.
Never copy live VPS credentials or signing material into this project.

`lesson.html` is student-only. Do not add it to an Nginx static-file location: requests must reach
`server.js`, which redirects unauthenticated users to sign in. macOS AppleDouble (`._*`) and
`.DS_Store` files are not publishable assets. `.dockerignore` excludes them from build contexts,
and the Dockerfile fails closed if either remains under `public/`. For a host static-root rollout,
use `deploy/prepare-public-static.py` to create a sanitized sibling stage before an atomic swap.

