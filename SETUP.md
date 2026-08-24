# Setup

The stats section of this profile is **self-hosted**: every chart and card is an SVG
generated into this repo by GitHub Actions, instead of being loaded live from
`github-readme-stats` / `streak-stats` / `github-profile-trophy` — shared public
instances that go down (503), run out of quota (402) or time out, leaving broken
images on the profile. A file in your own repo has none of those failure modes.

The system (scripts + workflows) is adapted from
[gargibhardwaj24/gargibhardwaj24](https://github.com/gargibhardwaj24/gargibhardwaj24).

## First-time setup

The committed `assets/*.svg` for the stat card, repo cards, language radar and
`metrics.*` are **placeholders** — dashed boxes that say which workflow fills them in.
Two things make the real ones appear:

### 1. Let Actions write to the repo

Repo → **Settings** → **Actions** → **General** → **Workflow permissions** →
select **Read and write permissions** → Save.

Without this the Charts, Metrics and Snake workflows fail on push.

### 2. Add the metrics token

`lowlighter/metrics` and the streak tiles need a personal access token — the built-in
`GITHUB_TOKEN` can't read profile-level data, so without one the workflows fall back
to it and render fewer tiles (or fail, in the case of Metrics).

1. https://github.com/settings/tokens → **Generate new token (classic)**
2. Scopes: **`read:user`** (add **`repo`** too if you want private repos counted)
3. Repo → **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret** → name it **`METRICS_TOKEN`**, paste the value

### 3. Kick off the workflows

Repo → **Actions** tab → run each one via **Run workflow**:

| workflow | produces | lands in |
|---|---|---|
| **Metrics** | 3D isometric calendar, language mix, achievements | `assets/metrics.*.svg` on `main` |
| **Charts and cards** | both radar charts, stat card, repo cards | `assets/radar*.svg`, `assets/card-*.svg` on `main` |
| **Generate Snake** | snake eating the contribution graph | the `output` branch |

After the first manual run they're on a schedule (metrics every 6h, snake daily,
charts daily) and also re-run on pushes to `main`.

## Tuning

### The skill radar

Edit `assets/skills.json` and push — values are 0-100 and entirely self-rated.
Five to eight axes reads best; past that the labels crowd each other. To preview
locally: `python scripts/radar.py --data assets/skills.json -o assets/radar`.

The second radar (`radar-langs`) is generated from real language byte counts across
the public repos, so it needs no editing. Two knobs in `.github/workflows/radar.yml`:

- `--exclude` drops languages you don't want counted (Shell/Makefile/Dockerfile are
  out by default, otherwise generated files skew everything).
- `--curve` controls how hard a dominant language is compressed. `1.0` is linear,
  `0.5` is sqrt, `0.4` is the default here, `0.3` flattens a one-language-dominant
  profile further.

### The stat and repo cards

- **Which repos get a card** is `assets/projects.json`. Stars, forks and language are
  fetched live on every run; the `description` there overrides the repo's own GitHub
  description.
- **The contribution and streak tiles need `METRICS_TOKEN`** (GraphQL API). Without
  it the stat card still renders, just with three tiles instead of six.

### Optional: a dot-matrix portrait

`scripts/dotify.py` turns a photo into an SVG dot-matrix portrait for the top of the
README. Drop a photo into `assets/` and run e.g.:

```bash
python scripts/dotify.py assets/me.png -o assets/portrait --cols 100 --equalize --detail 0.5 --color
```

then add `<img src="assets/portrait.svg" width="300">` to the README header.
`--help` lists the other modes (binary digits, ASCII, braille, circle crop, reveal
animation).

## If something looks broken

- **Placeholder boxes still showing** — the matching workflow hasn't completed on
  `main` yet, or write permissions (step 1) were skipped.
- **Metrics workflow fails** — almost always `METRICS_TOKEN`: missing, expired, or
  created as a fine-grained token instead of a classic one.
- **Snake image 404s** — the Snake workflow hasn't run since the `output` branch was
  last recreated.
