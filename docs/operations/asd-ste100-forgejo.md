# Forgejo host for T2 enforcement

This runbook is for operators.

This runbook is not a language-authority certificate.

Activate branch protection only after workflow dispatch succeeds.

## Host facts

Host name is `hhpe-forge`.

The container name is `forgejo`.

The image family is `codeberg.org/forgejo/forgejo`.

Data lives at `/home/oldmac-vm/forgejo/data`.

The database is SQLite at `/data/gitea.db`.

HTTP uses host port 3000.

SSH uses host port 2222.

ROOT_URL is `http://hhpe-forge.local:3000/`.

The untrusted runner unit is `forgejo-runner.service`.

The trusted runner unit is `forgejo-runner-t2-trusted.service`.

Runner version is v13.0.0.

Untrusted label is `hhpe-ci`.

Trusted label is `t2-trusted`.

The trusted runner is repo-scoped to `maxholden/T2-SQUARED`.

Live image is Forgejo 15.0.6.

Set `GITEA_WORK_DIR=/data` on recreate.

The trusted runner reads `ASD_STE100_VOCABULARY` as a filesystem path.

That path must match the SHA-256 pin in `t2.asd-ste100.json`.

The committed test fixture is `scripts/asd-ste100/test/fixtures/vocab/synthetic.json`.

Copy those bytes onto `t2-trusted`. Do not commit a private official word list.

Vocabulary review stays `pending-human` until an operator checks the word list.

G2 ignores Rule 1.1 and Rule 4.5 until that review.

G2 still applies sentence length rules and claim rules.

The leak scan rejects a dump of the private file.

The leak scan does not reject one source token.

G5 calls the review check.

G6 calls the override check.

PR and release fail when the review is missing.

Run `npm run asd-ste100:provision-vocab -- --dest <vocab-dir>` to mount the test fixture and refresh the pin.

Run `npm run asd-ste100:provision-vocab -- --verify-only --dest <vocab-dir>` to check the pin.

A human inspects the private file before any pin change off the fixture.

Rule 1.1 and Rule 4.5 stay off G2 in this slice.

Do not provision enforcement PATs yet.

Do not provision the release identity yet.

## Upgrade path

The staged path was 9.0.3 to 10.0.3.

The next waypoint was 10.0.3 to 11.0.16.

Hold on 11 ended after qualification stayed clean.

The later jump was 11.0.16 to 15.0.6.

That jump succeeded.

Versions 12, 13, and 14 remain rollback only.

Pinned 10 image is 10.0.3.

Pinned 11 image is 11.0.16.

Pinned 15 image is 15.0.6.

## Recreate command

```sh
docker run -d \
  --name forgejo \
  --restart always \
  -e USER_UID=1000 \
  -e USER_GID=1000 \
  -e GITEA_WORK_DIR=/data \
  -v /home/oldmac-vm/forgejo/data:/data \
  -p 3000:3000 \
  -p 2222:22 \
  codeberg.org/forgejo/forgejo:<tag>
```

Forgejo 15 refuses an unexpected SSH key file.

Copy `/data/git/.ssh/authorized_keys` first.

Then delete that file.

Let Forgejo rewrite it.

Cookie names changed in 15.

Users must sign in again.

Keep the previous stopped container.

## Stop and backup

Create `/data/log` if it is missing.

Stop `forgejo-runner.service`.

Stop `forgejo-runner-t2-trusted.service`.

Flush queues as UID 1000.

Stop the `forgejo` container.

Copy the data directory to a dated backup.

Save `docker inspect forgejo` next to that backup.

Restore is a stop, data replace, and start.

## Qualification

Record `/api/v1/version` after each waypoint.

Record `forgejo doctor check --all` as UID 1000.

Record SQLite `PRAGMA integrity_check`.

Record `git ls-remote` for a known repository.

Record runner labels `hhpe-ci` and `self-hosted`.

Record one Actions job when a safe workflow exists.

A failed check stops the next upgrade.

## Qualification record

### 9.0.3 baseline

Date is 2026-08-13.

API version is 9.0.3.

Stopped container is `forgejo-9-20260813`.

### 10.0.3

Status is a migration waypoint.

Date is 2026-08-13.

API version is 10.0.3.

Stopped container is `forgejo-10-20260813`.

SQLite check was ok.

Runner v13.0.0 declared `hhpe-ci`.

### 11.0.16

Status is waypoint complete.

Date is 2026-08-13.

API version is 11.0.16.

Stopped container is `forgejo-11-20260813`.

Pre-jump backup is `20260813T155536Z-pre-v15`.

SQLite check was ok.

Runner pairing stayed on v13.0.0.

### 15.0.6 LTS

Status is the live trust root.

Date is 2026-08-13.

API version is 15.0.6.

Qualified backup is `20260813T155959Z-v15-qualified`.

First 15 start failed on an unexpected SSH key.

An operator copied the key file then removed it.

Forgejo rewrote the file.

SQLite check was ok.

Runner pairing for U6 is v13.0.0 with `hhpe-ci`.

Remaining proofs are one Actions job, one package round-trip, and a restore drill.

## Distinct accounts

Use distinct Forgejo users for author, reviewer, CI, and release.

Human and agent reviewers need distinct identities.

Do not share reviewer credentials.

Reviewer PATs never enter CI.

The trusted runner serves only this repository.

Its systemd unit is `forgejo-runner-t2-trusted.service`.

Its work directory is `/home/oldmac-vm/forgejo-runner-t2-trusted/work`.

## Branch and tag protection

Required PR contexts are:

```text
asd-ste100 / advisory
asd-ste100 / trusted-pr
```

Required main context is `asd-ste100 / trusted-main`.

Protect tags that match `t2-v*`.

Only the release identity may create those tags.

Do not protect upstream `v*` tags as T2 releases.

GitHub Actions must stay disabled on the fork.

## Workflow stages

The untrusted job runs on `hhpe-ci`.

It has no vocabulary secret.

It has no API token.

The trusted job runs on `t2-trusted`.

It loads checker code from the merge base.

It loads pull-request bytes from the head tree.

It maps `GITHUB_TOKEN` and `PACKAGE_TOKEN` from secrets.

It mounts `ASD_STE100_VOCABULARY` from secrets on trusted jobs.

The pull-request tree is data only.

Do not run pull-request lifecycle scripts.

## Bootstrap

`t2.asd-ste100.anchor.json` stays bootstrap-pending until review.

Record the reviewed checker SHA.

Record the reviewer principal.

Record the fixture result.

Activate protections after workflow-dispatch validation.

Rerun the full corpus from that SHA.

Mount the test vocabulary path on `t2-trusted` after leak tests pass.

Use a private official extract only when those bytes exist off git.

## Secrets and rotation

Name an owner for each token.

Give each token minimum scope.

Set an expiration date.

Record a revocation step.

Unmount secrets at job end.

Start each trusted job from an empty workspace.

## Rollback

Stop the live container.

Replace data with a qualified backup.

Start the prior image tag.

Keep runner 13.0.0 unless a protocol error appears.
