# Training System Backup and Recovery

## Current status

Since 2026-10-04 Firebase project `sg-tms-v2` (Firestore `(default)`, location
`eur3`) has managed recovery enabled:

| Protection | Setting |
| --- | --- |
| Point-in-Time Recovery (PITR) | Enabled: any minute of the last 7 days |
| Daily scheduled backup | Retained 14 days |
| Weekly scheduled backup (Friday) | Retained 14 weeks |

Not covered by these backups:

- Firebase Authentication accounts: export separately with
  `firebase auth:export users.json --project sg-tms-v2`.
- Source code and the website: in GitHub; redeploy with the Actions workflow.

The manual ZIP backup on the Exports page (below) still works and is useful
before risky changes.

## Create a manual backup

1. Sign in with an administrator account.
2. Open the Exports page (`/exports`).
3. Choose the full system backup action.
4. Store `SABER_TMS_PACKUP_<timestamp>.zip` in an encrypted location outside
   the computer running the system.

The package contains `system_restore_data.json` and collection reports. It
contains student records, staff records, attendance, evaluations, integration
metadata, and other sensitive operational data.

## Restore a manual backup

1. Create a fresh backup of the current state first.
2. From the Exports page, choose Restore and select the ZIP.
3. Confirm only after verifying the ZIP project is `sg-tms-v2`.
4. Wait for completion, reload, then verify users, groups, students,
   attendance, evaluations, graduation projects, and Google integrations.

The current Training restore merges backup documents into Firestore. It does
not delete documents that are absent from the backup, so it is a recovery/import
operation rather than an exact point-in-time rollback.

## Firebase managed recovery

Run these in Cloud Shell as a project owner.

### Check backups

```bash
gcloud firestore backups schedules list --database='(default)' --project=sg-tms-v2
gcloud firestore backups list --project=sg-tms-v2
```

### Restore a scheduled backup

A backup is restored into a **new** database; the live `(default)` database is
not touched.

```bash
gcloud firestore databases restore \
  --source-backup=projects/sg-tms-v2/locations/eur3/backups/BACKUP_ID \
  --destination-database=restored-YYYYMMDD \
  --project=sg-tms-v2
```

### Recover data from a point in time (last 7 days)

Clone the database as it was at a given minute into a new database:

```bash
gcloud firestore databases clone \
  --source-database='projects/sg-tms-v2/databases/(default)' \
  --snapshot-time='2026-10-04T18:00:00Z' \
  --destination-database=pitr-YYYYMMDD \
  --project=sg-tms-v2
```

### After restoring

1. Inspect the restored database in the Firebase Console and compare it with
   the live data.
2. Either copy back only the documents that were lost, or point the app at
   the restored database (a code change in `firebase.ts` and the Cloud
   Functions, then redeploy). Plan this cutover before doing it.
3. Delete the temporary database when done to avoid storage cost.

### Recommended extra protection

Delete protection is currently disabled. Enable it so the database cannot be
deleted by mistake:

```bash
gcloud firestore databases update --database='(default)' --delete-protection --project=sg-tms-v2
```

Firebase Console path: `Firestore Database > Disaster recovery`

`https://console.firebase.google.com/project/sg-tms-v2/firestore/databases/-default-/disasterrecovery`
