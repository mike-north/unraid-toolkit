---
'@unraid-toolkit/sdk': patch
'@unraid-toolkit/mcp': patch
'@unraid-toolkit/cli': patch
'unraid-toolkit': patch
---

`createNotification` now returns a usable notification `id`.

Unraid's create mutation echoes back a UUID-based id but stores the notification
under a different, timestamp-based id, so the returned id could not be passed to
`archiveNotification`/`unarchiveNotification` (they failed with not-found).
`createNotification` now does a best-effort lookup of the unread queue and
returns the notification with the server's canonical id, so the
create → archive/unarchive flow works without an intervening list. If the lookup
can't run (e.g. an API key with notification write but not read scope) or finds
no match, the raw create response is returned unchanged.
