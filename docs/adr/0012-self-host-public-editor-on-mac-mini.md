# Self-host the public editor on the Mac Mini

Deploy `zoia.eimerreis.de` as separate web and codec containers from the `EimerReis-Enterprise` repository using its organization-wide self-hosted GitHub Actions runner. Both services join the existing external Docker network named `proxy`; Traefik routes `/api/*` to the codec and all other paths to the web container, while shared Traefik and Cloudflare Tunnel configuration and credentials remain outside this repository.

The deployment is stateless and requires no server database or persistent application volume. Production releases follow passing checks on `main`, build reproducible images containing the pinned codec dependency, update the Compose project, and verify web and codec health.
