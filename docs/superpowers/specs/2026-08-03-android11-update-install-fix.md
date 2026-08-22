# Fix: "App not installed" on Android 11 when updating (apply at next export)

**Status:** noted, NOT yet applied. Do this before the next APK export.

## Symptom
Sideloading a new APK fails with **"App not installed"** on Android 11, while the
same APK installs fine on Android 15. Only a full uninstall + phone reboot lets it
install. Bad UX for updates.

## Root cause
Android 11's `PackageInstaller` has a caching bug: installing an APK whose
`versionCode` is **equal to or lower than** a previously installed/seen build of the
same package (`com.stanleighmorales.centav0`) throws "App not installed" until the
package record is cleared (reboot). We hit it because the dev-client build and the
production build were **both `versionCode: 2`** (see `app.json` -> `android.versionCode`).
Same package + same keystore + same versionCode = collision on the Android 11 path.

Android 15's installer tolerates the same-versionCode reinstall, which is why it
worked there.

## The fix - bump versionCode on every release
Two options (pick one):

### Option A (recommended): auto-increment via EAS
`eas.json`:
```jsonc
{
  "cli": { "appVersionSource": "remote" },   // was "local"
  "build": {
    "production": {
      "autoIncrement": true,                  // add this
      "android": { "buildType": "apk" }
    }
  }
}
```
EAS then owns versionCode and bumps it every `production` build. Removes the
possibility of shipping two builds with the same code by accident.

### Option B: manual bump (keep appVersionSource "local")
Increment `app.json` -> `android.versionCode` (and usually `expo.version`) by hand
before each export. Current value is `2`; next export must be `3`, then `4`, ...
Never reuse a number.

## Must-keep invariants (already satisfied, don't break)
- **Same signing keystore** across all releases. EAS remote credentials already use
  `Build Credentials VD-k7d5fOf` - do NOT regenerate it, or every user has to
  uninstall to update.
- Same `android.package`.

## What this does NOT require
No app-code change. It's purely a build-versioning discipline. End users updating
from a properly-incremented previous release will get a clean in-place update with
no uninstall and no reboot.
