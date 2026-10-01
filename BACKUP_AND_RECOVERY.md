# Training System Backup and Recovery

## Current status

As checked on 2026-10-01, Firestore Point-in-Time Recovery and scheduled
backups are not enabled for Firebase project `sg-tms-v2`.

The application provides a manual backup from the Exports page. This is not
uploaded automatically: the ZIP only exists in the browser's Downloads folder
(or the folder selected by the browser).

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

Firebase Console path:

`Firestore Database > Disaster recovery`

Direct project page:

`https://console.firebase.google.com/project/sg-tms-v2/firestore/databases/-default-/disasterrecovery`

Recommended production policy:

- Enable Point-in-Time Recovery for short-window recovery.
- Add a daily scheduled backup with suitable retention.
- Add a longer-retention weekly backup.

These features add Firebase storage cost. A managed backup is restored into a
new Firestore database, so recovery must include validation and an application
cutover plan.
