# ROM Archiver

A self-hosted, Steam-like frontend for your local ROM library. Browse your games with cover art and metadata, verify ROMs against No-Intro/Redump databases, and download them on demand.

![ROM Archiver Screenshot](docs/screenshot.png)

## Features

- **Steam-like UI** — Dark, polished interface with cover art grid, platform sidebar, and game detail pages
- **IGDB Metadata** — Automatically fetches cover art, descriptions, ratings, screenshots, developers, and publishers
- **No-Intro / Redump Verification** — Import DAT files to verify ROM integrity and get canonical game names
- **Smart Auto-naming** — Strips region/revision tags and matches clean titles to IGDB
- **One-click Download** — Download any ROM directly from the browser
- **Platform Organization** — Auto-detects platforms from folder names and file extensions
- **Docker-ready** — Single container, works great on Unraid, TrueNAS, Synology, or any Docker host

---

## Quick Start

### Docker Compose

```yaml
version: '3.8'
services:
  rom-archiver:
    build: .
    container_name: rom-archiver
    ports:
      - "8096:8096"
    volumes:
      - /path/to/your/roms:/roms:ro
      - /path/to/appdata:/data
    environment:
      - IGDB_CLIENT_ID=your_client_id
      - IGDB_CLIENT_SECRET=your_client_secret
    restart: unless-stopped
```

Then open `http://your-server:8096` in your browser.

### Build from source

```bash
git clone https://github.com/yourusername/rom-archiver
cd rom-archiver
docker-compose up -d --build
```

---

## ROM Folder Structure

Organize your ROMs by platform. ROM Archiver auto-detects platforms from folder names:

```
/roms/
├── nes/
│   ├── Super Mario Bros. (USA).nes
│   └── Mega Man 2 (USA).nes
├── snes/
│   ├── Chrono Trigger (USA).sfc
│   └── Super Metroid (USA).sfc
├── n64/
│   └── The Legend of Zelda - Ocarina of Time (USA).z64
├── ps1/
│   └── Final Fantasy VII (USA)/
│       ├── Final Fantasy VII (USA).bin
│       └── Final Fantasy VII (USA).cue
└── gba/
    └── Pokemon - FireRed Version (USA).gba
```

### Supported Platforms & Extensions

| Platform | Folder Name | Extensions |
|---|---|---|
| NES | `nes` | `.nes` |
| SNES | `snes` | `.sfc`, `.smc` |
| Nintendo 64 | `n64` | `.z64`, `.n64`, `.v64` |
| Game Boy | `gb` | `.gb` |
| Game Boy Color | `gbc` | `.gbc` |
| Game Boy Advance | `gba` | `.gba` |
| Nintendo DS | `nds` | `.nds` |
| GameCube | `gamecube` | `.iso`, `.gcm` |
| Wii | `wii` | `.iso`, `.wbfs` |
| Sega Genesis | `genesis` | `.md`, `.gen`, `.smd` |
| Sega Saturn | `saturn` | `.bin`, `.iso` |
| Dreamcast | `dreamcast` | `.cdi`, `.gdi` |
| PlayStation | `ps1` | `.bin`, `.iso`, `.cue` |
| PlayStation 2 | `ps2` | `.iso` |
| PSP | `psp` | `.iso`, `.cso` |
| Atari 2600 | `atari2600` | `.a26` |
| Arcade | `arcade` | `.zip` |

---

## IGDB Setup (Free)

ROM Archiver uses IGDB for game metadata. Setup takes ~2 minutes:

1. Go to [dev.twitch.tv](https://dev.twitch.tv/console/apps) and log in with your Twitch account (free)
2. Create a new application → select "Application Integration" as the category
3. Copy your **Client ID** and generate a **Client Secret**
4. Enter them in ROM Archiver's Settings page

---

## No-Intro / Redump DAT Files

DAT files provide SHA1/MD5/CRC32 hashes for every known good ROM. Importing them lets ROM Archiver:
- Verify your ROMs are clean, unmodified dumps ✓
- Use canonical game names for better IGDB matching
- Flag modified or bad dumps

**Where to get them:**
- No-Intro: [no-intro.org](https://no-intro.org) — Create a free account, download platform DATs
- Redump: [redump.org](http://redump.org) — Optical disc games (PS1, PS2, GameCube, etc.)

**How to import:**
1. Go to Settings → No-Intro / Redump DAT Files
2. Click "Upload a .dat file"
3. Select your downloaded `.dat` file
4. ROM Archiver parses it and stores all hashes in its database

---

## Unraid Setup

1. In Unraid, go to **Docker** → **Add Container**
2. Click "Template repositories" → Add the ROM Archiver template URL
3. Or manually use these settings:

| Setting | Value |
|---|---|
| Repository | `ghcr.io/yourusername/rom-archiver:latest` |
| Port | `8096:8096` |
| ROM Path | `/mnt/user/roms` → `/roms` |
| App Data | `/mnt/user/appdata/rom-archiver` → `/data` |
| IGDB_CLIENT_ID | your client id |
| IGDB_CLIENT_SECRET | your client secret |

---

## Configuration

All settings are available in the web UI under **Settings**. You can also set them via environment variables:

| Variable | Default | Description |
|---|---|---|
| `IGDB_CLIENT_ID` | — | Twitch/IGDB Client ID |
| `IGDB_CLIENT_SECRET` | — | Twitch/IGDB Client Secret |
| `ROM_PATH` | `/roms` | Path to ROM library inside container |
| `DATA_PATH` | `/data` | Path for database and cached data |
| `TZ` | `America/New_York` | Timezone |

---

## API

ROM Archiver exposes a REST API at `/api/`:

```
GET  /api/platforms              List all platforms
GET  /api/games?platform_id=&search=&sort=&page=  List games
GET  /api/games/{id}             Get game details
GET  /api/games/{id}/download    Download ROM file
POST /api/games/{id}/refresh     Re-fetch IGDB metadata
POST /api/scan                   Start library scan
GET  /api/scan/status            Get scan progress
GET  /api/stats                  Library statistics
GET  /api/settings               Get settings
PUT  /api/settings               Update settings
POST /api/dats/import            Import a DAT file
```

---

## Tech Stack

- **Backend**: Python / FastAPI / SQLAlchemy (SQLite)
- **Frontend**: React 18 / TypeScript / Vite / Tailwind CSS
- **Metadata**: IGDB API (via Twitch OAuth)
- **ROM DB**: No-Intro / Redump DAT XML parsing
- **Container**: Docker multi-stage build
