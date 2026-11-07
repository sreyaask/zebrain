# Penned for iPhone (SwiftUI)

Customer app: sign in with email and password, scan your handwriting sheet, scan or import the pages to copy
(text is read on the phone with Apple's Vision), choose layout and paper, place the order, and track it.

## Open and run

1. Open `ios/Penned.xcodeproj` in Xcode 16 or newer (it uses Xcode 16's folder-synced project format).
2. Xcode downloads the `supabase-swift` package on first open (File → Packages → Resolve if it doesn't).
3. In `Penned/Config.swift`, paste your Supabase project URL and publishable key.
4. Select the **Penned** target → Signing & Capabilities → choose your Team.
5. Run on an iPhone (the document scanner needs a real camera; the simulator can still use "Choose photos").

Requires iOS 17.

## Supabase settings the app relies on

- **No emails needed:** in Supabase → Authentication → Sign In / Providers → Email, turn **off** "Confirm email".
  Accounts are then created instantly with email + password, and Supabase never has to send an email.
- Database, storage buckets and security rules come from `../supabase/migrations`.

## Not compiled in CI

This project was written without a Mac, so it has not been compiled yet. If Xcode reports an error on first
build, it will most likely be a small supabase-swift API difference; the fix is usually a renamed argument.
