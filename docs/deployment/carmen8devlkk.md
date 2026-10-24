# Deploying to carmen8devlkk.wcpss.net/oracle-data-v2

Instructions for creating the server directory and setting up GitLab CI/CD for this project
(`docu-library-pro-copy`), modeled on the existing `oracle-data-v2` pipeline.

> **This app is deployed under a subpath**: `https://carmen8devlkk.wcpss.net/oracle-data-v2`
> (not at the domain root). The codebase supports this via `VITE_BASE_PATH` (build) and
> `BASE_PATH` (server). See §1 and §7 for details.

---

## 1. What this app is (deployment shape)

This is a **single Node.js process** that serves both the API and the frontend:

| Piece | Detail |
|---|---|
| Backend | Express 5 (`server/index.js`), listens on `process.env.PORT` (default `3001`) |
| Frontend | Vite build output in `dist/` — served by Express via `express.static` + SPA fallback |
| Database | MySQL/MariaDB (connection via `DB_*` env vars) |
| Runtime | Node.js 20+ (built/tested on Node 24) |
| Build | `npm ci` → `npm run build` (Vite) |
| Start | `npm start` → `node server/index.js` |

### Subpath support (already wired in the code)

| Setting | Where | Purpose |
|---|---|---|
| `VITE_BASE_PATH` | build-time env for `vite build` | prefixes asset URLs (`/oracle-data-v2/assets/...`) and sets the React Router `basename` + API base |
| `BASE_PATH` | runtime env for the Node server | mounts `express.static` and the SPA fallback under `/oracle-data-v2` |

For this deployment set **both** to `/oracle-data-v2`:
- `VITE_BASE_PATH=/oracle-data-v2/` (note trailing slash — Vite convention)
- `BASE_PATH=/oracle-data-v2` (no trailing slash)

If both are unset, the app serves at the domain root exactly as before (no behavior change).

Because Express serves `dist/` itself, **you do not need nginx to serve static files** — only to
reverse-proxy the `/oracle-data-v2` path to the Node port.

> Note: `server/config.js` loads `.env` and then `.env.local` (override). In production, prefer
> real environment variables injected by the runner/systemd rather than committing any `.env`.

---

## 2. Prerequisites on the target host

Run these on `carmen8devlkk.wcpss.net` (or the deploy user's account there):

```bash
# 1. Verify Node.js 20+ is available
node --version        # must be >= 20
npm --version

# 2. Create the application directory
sudo mkdir -p /var/www/carmen8devlkk/oracle-data-v2
sudo chown -R "$USER":"$USER" /var/www/carmen8devlkk/oracle-data-v2

# 3. (Optional) create a dedicated service user if you don't deploy as yourself
# sudo useradd -r -m -d /var/www/carmen8devlkk -s /bin/bash carmen8
# sudo chown -R carmen8:carmen8 /var/www/carmen8devlkk
```

Directory layout after first deploy:

```
/var/www/carmen8devlkk/oracle-data-v2/
├── server/            # Express API
├── dist/              # Vite build output (generated)
├── node_modules/      # installed by CI
├── package.json
├── package-lock.json
└── .env               # production secrets (created manually, NOT from git)
```

---

## 3. Create the GitLab CI/CD variables

In GitLab: **Project → Settings → CI/CD → Variables**. Add these (mark secrets as *Masked* and
*Protected*):

| Key | Example | Notes |
|---|---|---|
| `DEPLOY_HOST` | `carmen8devlkk.wcpss.net` | target server |
| `DEPLOY_USER` | `carmen8` | SSH user that owns `/var/www/carmen8devlkk` |
| `DEPLOY_PATH` | `/var/www/carmen8devlkk/oracle-data-v2` | absolute path on the server |
| `SSH_PRIVATE_KEY` | *(file/type: Variable, masked)* | private key for `DEPLOY_USER` |
| `SSH_KNOWN_HOSTS` | output of `ssh-keyscan carmen8devlkk.wcpss.net` | prevents host-key prompts |
| `VITE_BASE_PATH` | `/oracle-data-v2/` | **build-time** subpath (trailing slash) |
| `BASE_PATH` | `/oracle-data-v2` | **runtime** subpath (no trailing slash) |
| `DB_HOST` | `tandemdevl.wcpss.net` | MySQL host |
| `DB_PORT` | `3306` | |
| `DB_NAME` | `sdsportal` | |
| `DB_USER` | `sdsadmin` | |
| `DB_PASSWORD` | *(masked)* | |
| `JWT_SECRET` | *(masked)* | long random string |
| `APP_TITLE` | `Safety Knowledge Base` | optional |
| `APP_LOGO_URL` | *(url)* | optional |
| `PORT` | `3002` | port the Node process binds to (avoid clashing with other apps on the host) |
| `CLIENT_URL` | `https://carmen8devlkk.wcpss.net` | used for CORS (origin only, no path) |

> **Port note**: `oracle-data-v2` (or other apps) may already use `3001`. Pick an unused port
> (e.g. `3002`) and use the same value in the nginx proxy (§7) and the process manager (§6).

> If `oracle-data-v2` already defines shared variables at the **group** level
> (`Auxiliary`), you may only need to add the project-specific ones.

---

## 4. Generate the SSH key pair for CI

On your workstation:

```bash
ssh-keygen -t ed25519 -C "gitlab-ci-carmen8devlkk" -f ./carmen8_deploy_key -N ""
```

- Put the **private** key (`carmen8_deploy_key`) contents into the `SSH_PRIVATE_KEY` CI variable.
- Append the **public** key (`carmen8_deploy_key.pub`) to the deploy user's
  `~/.ssh/authorized_keys` on the server:

```bash
ssh carmen8@carmen8devlkk.wcpss.net
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<contents of carmen8_deploy_key.pub>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Capture the host key for `SSH_KNOWN_HOSTS`:

```bash
ssh-keyscan carmen8devlkk.wcpss.net
```

---

## 5. Add `.gitlab-ci.yml` to the repo root

```yaml
stages:
  - build
  - deploy

variables:
  NODE_VERSION: "20"

# ---------- BUILD ----------
build:
  stage: build
  image: node:20
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
  script:
    - npm ci
    - VITE_BASE_PATH="$VITE_BASE_PATH" npm run build   # produces dist/ with /oracle-data-v2/ asset paths
  artifacts:
    paths:
      - dist/
      - package.json
      - package-lock.json
      - server/
    expire_in: 1 week
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

# ---------- DEPLOY ----------
deploy:
  stage: deploy
  image: alpine:3.20
  needs: ["build"]
  before_script:
    - apk add --no-cache openssh-client rsync
    - eval "$(ssh-agent -s)"
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
  script:
    # 1. Sync build output + server code (exclude dev-only files)
    - rsync -az --delete-after
        --exclude node_modules
        --exclude .git
        --exclude .env
        --exclude .env.local
        ./ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

    # 2. Write production env file from CI variables
    - |
      ssh "$DEPLOY_USER@$DEPLOY_HOST" "cat > $DEPLOY_PATH/.env <<'EOF'
      NODE_ENV=production
      PORT=$PORT
      BASE_PATH=$BASE_PATH
      CLIENT_URL=$CLIENT_URL
      DB_HOST=$DB_HOST
      DB_PORT=$DB_PORT
      DB_NAME=$DB_NAME
      DB_USER=$DB_USER
      DB_PASSWORD=$DB_PASSWORD
      JWT_SECRET=$JWT_SECRET
      APP_TITLE=$APP_TITLE
      APP_LOGO_URL=$APP_LOGO_URL
      EOF"

    # 3. Install prod deps and (re)start via pm2
    - |
      ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH \
        && npm ci --omit=dev \
        && (pm2 describe docu-library-pro > /dev/null 2>&1 \
              && pm2 restart docu-library-pro --update-env \
              || pm2 start server/index.js --name docu-library-pro) \
        && pm2 save"
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
```

> If `oracle-data-v2` uses a different deploy mechanism (e.g. `scp` + `systemctl restart`),
> mirror that instead — the important parts are: rsync the built app, write `.env`, install
> prod deps, restart the process.

---

## 6. Process management on the server (choose one)

### Option A — pm2 (recommended, matches the CI above)

```bash
sudo npm install -g pm2
cd /var/www/carmen8devlkk/oracle-data-v2
pm2 start server/index.js --name docu-library-pro
pm2 save
pm2 startup            # follow the printed command to enable boot start
```

Useful commands: `pm2 status`, `pm2 logs docu-library-pro`, `pm2 restart docu-library-pro`.

> Keep the pm2 `--name` consistent with the CI deploy step (`docu-library-pro`). If you rename
> it, update the `pm2 describe/restart` lines in `.gitlab-ci.yml` too.

### Option B — systemd

`/etc/systemd/system/docu-library-pro.service`:

```ini
[Unit]
Description=Docu Library Pro (KBB Portal)
After=network.target

[Service]
Type=simple
User=carmen8
WorkingDirectory=/var/www/carmen8devlkk/oracle-data-v2
EnvironmentFile=/var/www/carmen8devlkk/oracle-data-v2/.env
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now docu-library-pro
sudo systemctl status docu-library-pro
```

If you use systemd, change the CI deploy step's restart command to:
`sudo systemctl restart docu-library-pro` (grant the deploy user passwordless sudo for that one
command via `visudo`).

---

## 7. Reverse proxy (only if the host fronts apps with nginx/Apache)

The Node process listens on `$PORT` (e.g. `3002`). Proxy **only the `/oracle-data-v2` path** to it
so other apps on the same domain keep working.

**nginx** — add this `location` block to the existing `carmen8devlkk.wcpss.net` server block
(do not create a second `server_name` block if one already exists for this host):

```nginx
    # allow large SDS file uploads (Express multer limit is 10 MB)
    client_max_body_size 20m;

    location /oracle-data-v2/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
```

> **Trailing-slash matters**: `proxy_pass http://127.0.0.1:3002/;` (with the trailing `/`) strips
> the `/oracle-data-v2` prefix before forwarding, which matches the app's `BASE_PATH` mounting
> (`express.static` at `/oracle-data-v2`). If your other apps use a different convention, match
> theirs — but then set `BASE_PATH` accordingly (or leave it empty and keep the prefix in the
> proxy_pass target).

```bash
sudo nginx -t && sudo systemctl reload nginx
```

TLS is already handled by the existing `carmen8devlkk.wcpss.net` vhost — no new certificate
needed for the subpath.

> If your other apps (`oracle-data-v2`) are served directly by IIS or another proxy, follow the
> same pattern they use — the only requirement is that `carmen8devlkk.wcpss.net` proxies to
> `http://127.0.0.1:$PORT`.

---

## 8. First-time database setup

The schema must exist before the app can serve data. Run once against the target DB:

```bash
# on the server, after the first deploy (with .env in place)
cd /var/www/carmen8devlkk/oracle-data-v2
node server/scripts/init-db.js          # creates tables + seeds default settings tabs
```

If you need to copy data from the old Turso database, run the migration from a machine that has
both sets of credentials:

```bash
npm install --no-save @libsql/client
node server/scripts/migrate-data.js
```

> Note: the `sdsadmin` MySQL user may lack `INDEX`/`ALTER` privileges — `init-db.js` warns and
> skips secondary indexes in that case. Ask the DBA to grant `INDEX, ALTER` on `sdsportal.*` if
> you want the performance indexes created.

---

## 9. Verify the deployment

```bash
# on the server (note the BASE_PATH prefix on the app routes)
curl -s http://127.0.0.1:3002/api/health                          # {"status":"ok","db":"connected"}
curl -sI http://127.0.0.1:3002/oracle-data-v2/                    # 200 + index.html
pm2 logs docu-library-pro --lines 50                              # or: journalctl -u docu-library-pro -n 50

# from anywhere
curl -sI https://carmen8devlkk.wcpss.net/oracle-data-v2/          # 200 + index.html
```

Check that the built HTML references the subpath:

```bash
grep -o '/oracle-data-v2/assets/[^"]*' dist/index.html            # should list JS/CSS bundles
```

Common failure modes (see also `docs/fixes/deployment-error.md`):

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot GET /oracle-data-v2/` | Express not serving `dist/` under BASE_PATH | ensure `BASE_PATH=/oracle-data-v2` in `.env` and `dist/` was rsynced |
| Blank page, console 404s on `/assets/*` (no prefix) | built without `VITE_BASE_PATH` | rebuild with `VITE_BASE_PATH=/oracle-data-v2/` |
| Blank page, console 404s on `/oracle-data-v2/assets/*` | nginx not stripping prefix, or `dist/` missing | check `proxy_pass` trailing slash and that `dist/` deployed |
| 503 / app won't start | missing `.env` or DB unreachable | check `.env` exists and `DB_*` are correct |
| CORS errors | `CLIENT_URL` mismatch | set `CLIENT_URL=https://carmen8devlkk.wcpss.net` (origin only) |
| App loads but API 404s | `BASE_PATH` set but nginx strips it | either keep `BASE_PATH` and proxy without stripping, or unset `BASE_PATH` and strip in nginx — the two must agree |

---

## 10. Checklist

- [ ] Node 20+ installed on `carmen8devlkk.wcpss.net`
- [ ] `/var/www/carmen8devlkk/oracle-data-v2` created and owned by the deploy user
- [ ] SSH key pair generated; public key in `authorized_keys`; host key captured
- [ ] GitLab CI/CD variables added (incl. `VITE_BASE_PATH`, `BASE_PATH`, `DB_*`, `JWT_SECRET`, `SSH_PRIVATE_KEY`)
- [ ] `.gitlab-ci.yml` committed to `main` (build uses `VITE_BASE_PATH`, deploy writes `BASE_PATH`)
- [ ] Free port chosen (e.g. `3002`) and used consistently in `.env`, nginx, and pm2/systemd
- [ ] Process manager configured (pm2 or systemd) and enabled at boot
- [ ] nginx `location /oracle-data-v2/` proxy added to the existing vhost
- [ ] `node server/scripts/init-db.js` run once
- [ ] `http://127.0.0.1:<PORT>/api/health` returns `db: connected`
- [ ] `https://carmen8devlkk.wcpss.net/oracle-data-v2/` loads the app
- [ ] `dist/index.html` asset URLs are prefixed with `/oracle-data-v2/`
