# prayer-pwa container (docker-138)

Replaces the native `prayer-pwa.service` (proxy.mjs on :3000) and `prayer-pwa-app@3001.service` (standalone on :3001) as of 2026-11-24 1:43 AM ET.

- Image `prayer-pwa-app:<date>` is built from a snapshot of the LIVE standalone release tree (`~/prayer-pwa/releases/3001` copied to `./app-3001`). No build step, no db:migrate.
- `network_mode: host`, listens on 0.0.0.0:3000 (Cloudflare tunnel → 10.10.96.138:3000 unchanged; DATABASE_URL to localhost:5432 unchanged).
- env_file `~/prayer-pwa/.env.local`; notification scheduler secret mounted read-only at `/run/appcreds/` with `CREDENTIALS_DIRECTORY=/run/appcreds`.
- `prayer-notifications.timer` still curls http://127.0.0.1:3000 (its unit no longer Requires prayer-pwa.service).
- **`deploy/release.sh` is now obsolete**: it would start the old slot units + proxy and collide on :3000. New release = rebuild the standalone tree, copy into `app-3001` (or a new dir), `docker build`, `docker compose up -d`.

Run: `cd ~/prayer-pwa-docker && docker compose up -d`
Test on another port: `CONTAINER_NAME=prayer-pwa-test APP_PORT=3003 APP_HOST=127.0.0.1 docker compose -p prayer-pwa-test up -d`

Rollback:
```
cd ~/prayer-pwa-docker && docker compose down
cp -a ~/.config/systemd/user/prayer-notifications.service.bak-20261124 ~/.config/systemd/user/prayer-notifications.service
systemctl --user daemon-reload
systemctl --user enable --now prayer-pwa-app@3001.service prayer-pwa.service
```
