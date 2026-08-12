# Public deployment

`zoia.eimerreis.de` runs as two stateless containers on the Mac Mini:

- `web` serves the browser application.
- `codec` transiently parses and compiles ZOIA data.

Traefik routes `/api/*` to `codec` and all other paths to `web`. Both join the pre-existing external Docker network `proxy`. The shared Traefik instance, Cloudflare Tunnel credentials, and tunnel configuration intentionally live outside this repository.

## One-time host setup

1. Transfer the repository to `EimerReis-Enterprise`.
2. Confirm the organization self-hosted runner can access Docker.
3. Confirm the external network exists: `docker network inspect proxy`.
4. Add `zoia.eimerreis.de` to the shared Cloudflare Tunnel, forwarding it to Traefik.
5. Create a GitHub Actions environment named `production`.

Pushes to `main` run checks, build both images, and deploy through the self-hosted runner. `deploy/deploy.sh` waits for both container health checks and restores the previously tagged images if the new release does not become healthy.

## Manual deployment

```bash
bash deploy/deploy.sh manual-$(git rev-parse --short HEAD)
```

No application database, server-side Patch storage, or persistent volume is used. Browser recovery and Patch History remain in each user's Local Workspace.
