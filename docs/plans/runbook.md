# Runbook — Build & Run on carmen8devlkk.wcpss.net

A hands-on, ordered walkthrough for building and running this app on the on-prem server at
`https://carmen8devlkk.wcpss.net/oracle-data-v2`, using SSH + sudo and a GitLab runner.

> **App shape**: one Node.js process (Express 5) that serves both the API and the Vite-built
> `dist/` frontend. It runs on a port (e.g. `3002`); nginx proxies `/oracle-data-v2/` to it.

Follow the phases in order. Each phase has a **verify** step — don't move on until it passes.

---

## Progress tracker

Tick these off as you go. (Replaces the one-page checklist at the bottom; keep both in sync.)

### Phase 1 — Prepare server
- [ ] 1.1 Node 20+ confirmed/installed
- [ ] 1.2 Free port chosen (record it here: `______`)
- [ ] 1.3 App directory created + owned by deploy user

### Phase 2 — First manual build
- [ ] 2.1 Repo cloned into app directory
- [ ] 2.2 `.env` written (BASE_PATH, PORT, DB_*, JWT_SECRET) + `chmod 600`
- [ ] 2.3 `npm ci` + `VITE_BASE_PATH=/oracle-data-v2/ npm run build` → prefixed assets confirmed
- [ ] 2.4 `node server/scripts/init-db.js` run once
- [ ] 2.5 Foreground test: `/api/health` = connected, `/oracle-data-v2/` = 200

### Phase 3 — Run as a service
- [ ] 3 Service running (pm2 **or** systemd) + enabled at boot

### Phase 4 — nginx
- [ ] 4 `location /oracle-data-v2/` added to existing vhost; `nginx -t` passes; public URL = 200

### Phase 5 — GitLab runner
- [ ] 5.1 SSH key added to deploy user's `authorized_keys` (+ sudoers if systemd)
- [ ] 5.2 CI/CD variables set
- [ ] 5.3 `.gitlab-ci.yml` committed to `main`
- [ ] 5.4 Runner available for the project
- [ ] 5.5 Pipeline green; deployed site verified

---

## Phase 0 — Gather what you need

Before touching the server, have these ready:

| Item | Example | Notes |
|---|---|---|
| Server host | `carmen8devlkk.wcpss.net` | SSH access |
| Deploy user | `carmen8` (or your own account) | must have sudo |
| App directory | `/var/www/carmen8devlkk/oracle-data-v2` | created in Phase 1 |
| Port | `3002` | pick one not already used (check Phase 1) |
| MySQL host/db/user/pass | `tandemdevl.wcpss.net` / `sdsportal` / `sdsadmin` / … | |
| JWT secret | long random string | |
| GitLab project | `https://titan.wcpss.net/Auxiliary/docu-library-pro-copy` | |

---

## Phase 1 — Prepare the server (SSH + sudo)

SSH in:

```bash
ssh carmen8@carmen8devlkk.wcpss.net
```

### 1.1 Check Node.js

```bash
node --version    # must be >= 20
npm --version
```

If Node is missing or too old, install Node 20 LTS (pick the method your server already uses):

```bash
# Option A: NodeSource (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Option B: if nvm is used on this host
# nvm install 20 && nvm use 20
```

Verify again: `node --version` → `v20.x` or newer.

### 1.2 Choose a free port

```bash
# See what's already listening (other apps on this host)
sudo ss -ltnp | grep -E ':(300[0-9]|5173)' || true
```

Pick a port that isn't listed — this guide assumes **3002**. Remember it; it's used in `.env`,
nginx, and pm2/systemd.

### 1.3 Create the app directory

```bash
sudo mkdir -p /var/www/carmen8devlkk/oracle-data-v2
sudo chown -R carmen8:carmen8 /var/www/carmen8devlkk/oracle-data-v2
ls -ld /var/www/carmen8devlkk/oracle-data-v2   # confirm ownership
```

**Verify**: the `ls -ld` shows your deploy user as owner.

---

## Phase 2 — First manual build (prove it works before automating)

Doing this by hand once makes the CI pipeline trivial to debug later.

### 2.1 Clone the repo

```bash
cd /var/www/carmen8devlkk/oracle-data-v2
git clone https://titan.wcpss.net/Auxiliary/docu-library-pro-copy.git .
# If the repo is private, use a deploy token / SSH URL your runner will also use.
```

### 2.2 Create the production `.env`

```bash
nano /var/www/carmen8devlkk/oracle-data-v2/.env
```

Paste (fill in real values):

```dotenv
NODE_ENV=production
PORT=3002
BASE_PATH=/oracle-data-v2
CLIENT_URL=https://carmen8devlkk.wcpss.net

DB_HOST=tandemdevl.wcpss.net
DB_PORT=3306
DB_NAME=sdsportal
DB_USER=sdsadmin
DB_PASSWORD=changeme

JWT_SECRET=changeme-to-a-long-random-string

APP_TITLE=Safety Knowledge Base
APP_LOGO_URL=
```

Lock it down:

```bash
chmod 600 /var/www/carmen8devlkk/oracle-data-v2/.env
```

> `BASE_PATH` (no trailing slash) tells Express to serve the app under `/oracle-data-v2`.

### 2.3 Install dependencies and build

```bash
cd /var/www/carmen8devlkk/oracle-data-v2

# Install all deps (dev deps needed to build)
npm ci

# Build the frontend WITH the subpath baked into asset URLs
VITE_BASE_PATH=/oracle-data-v2/ npm run build
```

**Verify the build output references the subpath:**

```bash
grep -o '/oracle-data-v2/assets/[^"]*' dist/index.html
# Expect: /oracle-data-v2/assets/index-XXXX.js and .../index-XXXX.css
```

If you see `/assets/...` (no prefix), the build didn't get `VITE_BASE_PATH` — re-run 2.3.

### 2.4 Initialize the database (once)

```bash
cd /var/www/carmen8devlkk/oracle-data-v2
node server/scripts/init-db.js
```

Expected: table-creation log lines, `Settings tabs seeded...`, `Database schema initialized`.
(Index warnings are OK — the DB user may lack `INDEX`/`ALTER`; see the note at the end.)

> Only run this the first time, or when the schema changes. It is safe to re-run (uses
> `CREATE TABLE IF NOT EXISTS`), but it will not alter existing tables.

### 2.5 Test-run the app in the foreground

```bash
cd /var/www/carmen8devlkk/oracle-data-v2
NODE_ENV=production node server/index.js
```

In a **second SSH session**, verify:

```bash
curl -s http://127.0.0.1:3002/api/health
# {"status":"ok","db":"connected"}

curl -sI http://127.0.0.1:3002/oracle-data-v2/
# HTTP/1.1 200 OK
```

Stop the foreground process with `Ctrl+C` once both checks pass.

---

## Phase 3 — Run it as a service (pick one)

### Option A — pm2 (simplest)

```bash
sudo npm install -g pm2

cd /var/www/carmen8devlkk/oracle-data-v2
pm2 start server/index.js --name docu-library-pro
pm2 save

# Enable start-on-boot (run the command pm2 prints)
pm2 startup
```

**Verify**: `pm2 status` shows `docu-library-pro` as `online`; `curl` health check still passes.

### Option B — systemd

Create `/etc/systemd/system/docu-library-pro.service`:

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

**Verify**: `active (running)`, and the health check passes.

---

## Phase 4 — Reverse proxy for the subpath (Apache httpd)

> **This host uses Apache (`httpd`), not nginx.** nginx is installed but inactive; `httpd` owns
> ports 80/443. The live vhost config is `/etc/httpd/conf.d/sandbox.conf`.

### Option A — run the bootstrap script (recommended)

The repo includes `deploy/bootstrap-doc-library-pro-v1.sh`, modeled on
`bootstrap-oracle-data-v2.sh`. It idempotently inserts a `# ── BEGIN/END doc-library-pro-v1 ──`
block into the `carmen8devlkk` vhost, backs up the config, runs `apachectl configtest`, reloads
`httpd`, and auto-restores the backup if the test fails.

```bash
cd /doc-library-pro-v1
sudo ./deploy/bootstrap-doc-library-pro-v1.sh
```

Override defaults via env if needed:

```bash
sudo APP_PORT=3002 APP_SLUG=doc-library-pro-v1 \
     HTTPD_CONF=/etc/httpd/conf.d/sandbox.conf VHOST_MATCH=devlkk \
     ./deploy/bootstrap-doc-library-pro-v1.sh
```

Re-running the script **replaces** the existing block (no duplicates).

### Option B — edit `sandbox.conf` by hand

Inside the `<VirtualHost>` whose `DocumentRoot /var/www/sites/devlkk/public` matches
`carmen8devlkk.wcpss.net`, add:

```apache
    # ── BEGIN doc-library-pro-v1 ──
    ProxyPass        /doc-library-pro-v1/ http://127.0.0.1:3002/
    ProxyPassReverse /doc-library-pro-v1/ http://127.0.0.1:3002/
    RedirectMatch permanent ^/doc-library-pro-v1$ /doc-library-pro-v1/
    # ── END doc-library-pro-v1 ──
```

```bash
sudo cp /etc/httpd/conf.d/sandbox.conf /etc/httpd/conf.d/sandbox.conf.bak-$(date +%Y%m%d-%H%M%S)
sudo apachectl configtest && sudo systemctl reload httpd
```

**Verify** (from your workstation):

```bash
curl -sI https://carmen8devlkk.wcpss.net/doc-library-pro-v1/ | head -5
# HTTP/1.1 200 OK

curl -s https://carmen8devlkk.wcpss.net/doc-library-pro-v1/api/health; echo
# {"status":"ok","db":"connected"}
```

> **Prefix rule**: `ProxyPass /doc-library-pro-v1/ http://127.0.0.1:3002/` — the trailing slash on
> **both** sides strips `/doc-library-pro-v1` before forwarding, matching
> `BASE_PATH=/doc-library-pro-v1` in the app. The `oracle-data-v2` block in `sandbox.conf` follows
> the same convention (its inline comment warns about this exact one-character difference).
> If the app is not running on the port, Apache returns **503** instead of 200.

---

## Phase 5 — Automate with the GitLab runner

Now that a manual build works, wire it into CI. The runner needs to reach the server over SSH.

### 5.1 Runner SSH key

On the machine that will hold the key (or the runner host):

```bash
ssh-keygen -t ed25519 -C "gitlab-ci-carmen8" -f ./carmen8_ci -N ""
```

- Add the **public** key (`carmen8_ci.pub`) to the deploy user's `authorized_keys` on the server:
  ```bash
  # on carmen8devlkk
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  echo "<contents of carmen8_ci.pub>" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  ```
- If you use **systemd** (Option B), let the deploy user restart the service without a password:
  ```bash
  sudo visudo -f /etc/sudoers.d/docu-library-pro
  # add:
  carmen8 ALL=(ALL) NOPASSWD: /bin/systemctl restart docu-library-pro
  ```

### 5.2 GitLab CI/CD variables

Project → **Settings → CI/CD → Variables**:

| Key | Value | Flags |
|---|---|---|
| `DEPLOY_HOST` | `carmen8devlkk.wcpss.net` | |
| `DEPLOY_USER` | `carmen8` | |
| `DEPLOY_PATH` | `/var/www/carmen8devlkk/oracle-data-v2` | |
| `SSH_PRIVATE_KEY` | contents of `carmen8_ci` | Masked, Protected |
| `SSH_KNOWN_HOSTS` | `ssh-keyscan carmen8devlkk.wcpss.net` output | |
| `VITE_BASE_PATH` | `/oracle-data-v2/` | |
| `BASE_PATH` | `/oracle-data-v2` | |
| `PORT` | `3002` | |
| `CLIENT_URL` | `https://carmen8devlkk.wcpss.net` | |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | as in `.env` | password Masked |
| `JWT_SECRET` | long random | Masked |
| `APP_TITLE` / `APP_LOGO_URL` | optional | |

### 5.3 `.gitlab-ci.yml` (repo root)

```yaml
stages:
  - build
  - deploy

build:
  stage: build
  image: node:20
  cache:
    key:
      files: [package-lock.json]
    paths: [node_modules/]
  script:
    - npm ci
    - VITE_BASE_PATH="$VITE_BASE_PATH" npm run build
  artifacts:
    paths: [dist/, server/, package.json, package-lock.json]
    expire_in: 1 week
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'

deploy:
  stage: deploy
  image: alpine:3.20
  needs: [build]
  before_script:
    - apk add --no-cache openssh-client rsync
    - eval "$(ssh-agent -s)"
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$SSH_KNOWN_HOSTS" > ~/.ssh/known_hosts
  script:
    # 1. Sync build output + server code (never the local .env)
    - rsync -az --delete-after
        --exclude node_modules --exclude .git --exclude .env --exclude .env.local
        ./ "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

    # 2. Write production .env from CI variables
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

    # 3. Install prod deps and restart
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

> **Using systemd instead of pm2?** Replace step 3's restart with:
> `ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && npm ci --omit=dev && sudo systemctl restart docu-library-pro"`

### 5.4 Register the runner (if not already registered for this project)

If `oracle-data-v2` already uses a runner on this host, you can reuse it — just make sure it has
network access to `carmen8devlkk.wcpss.net` and the CI variables above. Otherwise:

```bash
# on the runner host, using the token from GitLab → Settings → CI/CD → Runners
gitlab-runner register \
  --url https://titan.wcpss.net/ \
  --token <RUNNER_TOKEN> \
  --executor shell \
  --description "carmen8devlkk runner"
```

### 5.5 Trigger and verify the pipeline

Push to `main` (or run the pipeline manually in GitLab → CI/CD → Pipelines). Then confirm:

```bash
# on the server
pm2 logs docu-library-pro --lines 50        # or: sudo journalctl -u docu-library-pro -n 50

# from anywhere
curl -sI https://carmen8devlkk.wcpss.net/oracle-data-v2/      # 200
curl -s  https://carmen8devlkk.wcpss.net/oracle-data-v2/api/health   # db: connected
```

---

## Phase 6 — Ongoing workflow

| Task | Command |
|---|---|
| Deploy | `git push origin main` (pipeline builds + deploys) |
| Restart app | `pm2 restart docu-library-pro` / `sudo systemctl restart docu-library-pro` |
| View logs | `pm2 logs docu-library-pro` / `sudo journalctl -u docu-library-pro -f` |
| Manual rebuild | `cd $DEPLOY_PATH && VITE_BASE_PATH=/oracle-data-v2/ npm run build` |
| Schema change | `node server/scripts/init-db.js` (idempotent for new tables) |

---

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot GET /oracle-data-v2/` | `BASE_PATH` unset or `dist/` missing | set `BASE_PATH=/oracle-data-v2` in `.env`; confirm `dist/index.html` exists |
| Blank page + 404s on `/assets/*` (no prefix) | built without `VITE_BASE_PATH` | rebuild with `VITE_BASE_PATH=/oracle-data-v2/` |
| Blank page + 404s on `/oracle-data-v2/assets/*` | nginx not stripping prefix OR `dist/` not synced | check `proxy_pass` trailing slash; confirm rsync copied `dist/` |
| API 404s but page loads | `BASE_PATH` and nginx prefix disagree | make them consistent (see Phase 4 note) |
| 502 Bad Gateway | Node process down / wrong port | `pm2 status` / `systemctl status`; confirm port matches nginx |
| 503 / won't start | bad `.env` or DB unreachable | `pm2 logs`; verify `DB_*` and that MySQL is reachable |
| CORS errors | `CLIENT_URL` mismatch | set `CLIENT_URL=https://carmen8devlkk.wcpss.net` (origin only) |
| `INDEX command denied` on init | DB user lacks INDEX/ALTER | harmless; ask DBA for `GRANT INDEX, ALTER ON sdsportal.* TO 'sdsadmin'@'%'` |

---

## One-page checklist

- [ ] Node 20+ on server
- [ ] Free port chosen (e.g. 3002)
- [ ] `/var/www/carmen8devlkk/oracle-data-v2` created, owned by deploy user
- [ ] `.env` written with `BASE_PATH=/oracle-data-v2`, `PORT`, `DB_*`, `JWT_SECRET`; `chmod 600`
- [ ] `npm ci` + `VITE_BASE_PATH=/oracle-data-v2/ npm run build` → `dist/index.html` has prefixed assets
- [ ] `node server/scripts/init-db.js` run once
- [ ] Foreground test: `/api/health` = `db: connected`, `/oracle-data-v2/` = 200
- [ ] Service running (pm2 or systemd), enabled at boot
- [ ] nginx `location /oracle-data-v2/` proxies to the port; `nginx -t` passes
- [ ] `https://carmen8devlkk.wcpss.net/oracle-data-v2/` loads in a browser
- [ ] CI variables set; `.gitlab-ci.yml` committed; pipeline green on `main`
