# govie-services-messaging trunk-based CI/CD flow

All five app pipelines (`messaging-api`, `messaging-next`, `messaging-admin-next`,
`messaging-support`, `citizen-portal`) deploy from a single `main` branch.
**The environment is chosen by what triggers the run, resolved at compile time** —
the same commit is rebuilt per environment with that environment's variables (config
is baked into the image, so images are never promoted between environments).

## Trigger → environment resolution

| Trigger | `Build` signal | `targetEnv` | Variables & group | Deploy gate |
|---|---|---|---|---|
| PR (any branch) | `Build.Reason == PullRequest` | — | — | Build/checks only, **no deploy**; auto-cancel on new commit |
| Push to `main` | `refs/heads/main` | `dev` | `dev.yml` + `messaging-dev` | Auto-deploy dev + smoke tests + release-please PR upkeep |
| **Nightly build succeeds** — the `Messaging - Nightly Tests` pipeline (cron 06:30 UTC, Mon–Fri, from `main`) completes successfully and fires each app's `resources.pipelines` completion trigger | `Build.Reason == ResourceTrigger` | `uat` | `uat.yml` + `messaging-uat` | Rebuild images with UAT variables + deploy uat (ADO env `messaging-uat`) |
| Manual run, `targetEnvironment=uat` | queue-time parameter | `uat` | `uat.yml` + `messaging-uat` | Deploy uat (on-demand, e.g. hotfix verification) |
| Tag `<app>-v*` (pushed by release-please) | `refs/tags/…` | `prod` | `prod.yml` + `messaging-prod` | Deploy prod behind **`messaging-prod` manual approval** + wiki release note |

Prod is deliberately **not** offered as a manual override (`values: [auto, dev, uat]`,
where `auto` = derive from the trigger) — production is reachable only via a
release-please tag.

## Stage wiring notes

- **Env resolver** lives in each pipeline's `variables:` block: a compile-time
  `${{ if / elseif / else }}` ladder that selects the variable file, the
  `messaging-<env>` secrets group (plus `journey-builder[-uat]` for `messaging-api`
  and `citizen-portal`), and the `targetEnv` value together. Everything downstream
  keys off `variables.targetEnv` (smoke tests, cross-repo regression, wiki release
  note) — no reference to `Build.SourceBranchName` for env selection remains.
- **UAT is gated behind the nightly build (no direct cron).** Cron is **not** a
  trigger on the app pipelines. Instead the `Messaging - Nightly Tests` pipeline runs
  on its own weekday 06:30 schedule from `main`; each app pipeline declares it as a
  `resources.pipelines` completion trigger, so a **successful** nightly run rebuilds
  the images with `uat.yml` variables and deploys UAT (`Build.Reason == ResourceTrigger`
  → `targetEnv = uat`). A failed nightly does not fire the trigger, so a broken build
  never reaches UAT. On-demand UAT is still available via `targetEnvironment=uat`.
- **Shared template** (`building-blocks-pipelines` → `pipelines/application.yml`)
  receives `targetEnvironment: ${{ variables.targetEnv }}`. The embedded release-please
  stage is gated on `releasePleaseEnabled && targetEnv == dev && Build.SourceBranch ==
  refs/heads/main`, so it runs on `main` pushes only — never on the nightly-triggered
  UAT run or tag-driven prod runs. Pinned to template tag `v0.20.0` (the release that
  carries `targetEnvironment` + `releasePlease*` support).
- **Cross-repo regression** (`test/cross_repo_regression.yml`, journey-builder suite)
  runs as a `postDeploymentJob` on `dev`/`uat` for `messaging-api` and `citizen-portal`,
  exactly as before — only the branch condition became `targetEnv` based.
- **Independent versioning:** each app points release-please at its own single-package
  config + manifest (`release-please/<app>.{config,manifest}.json`) and its own tag glob
  (`<app>-v*`), so an app's release PR and tag only ever fire its own pipeline. Versions
  are seeded to match each app's `package.json` (`messaging-api` at `1.0.0`, the rest at
  `0.1.0`).
- **Tag format is pinned explicitly** in each config (`include-component-in-tag: true`,
  `include-v-in-tag: true`, `tag-separator: "-"`) → `<component>-v<version>` e.g.
  `messaging-api-v1.2.0`. This is what each pipeline `trigger.tags.include` glob matches;
  keeping it explicit prevents a future release-please default change from silently
  drifting away from that glob.
- **Docker image tags** depend on the environment:
  - **prod** (tag-triggered): the image is tagged with the **git tag value**
    (`$(Build.SourceBranchName)` → `<app>-v1.2.0`) for release traceability.
  - **dev / uat**: the shared template default (`Build.BuildId` + commit SHA).

## Public mirror

`pipeline-public-mirror.yml` snapshots the repo (filtered by `.publicignore`) to the
public `ogcio/govie-messagingie` repo. With production reached via release-please tags,
it triggers on **any `*-v*` tag** rather than a `prod` branch. The mirror script refuses
a second same-day release commit, so if two apps release on the same day the later run
fails loudly rather than creating a duplicate release.

## Two human actions to reach production

1. Merge the feature PR into `main` → dev deploy + release-please updates the app's release PR.
2. Merge the app's `chore(auto-release):` release PR → release-please pushes the tag → prod
   rebuild + deploy (behind the `messaging-prod` approval).
