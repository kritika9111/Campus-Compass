# Campus Compass

A campus Lost & Found service for students and staff.

## Backend

- MongoDB Atlas stores users, reports, claims, messages, histories, saved items, notifications, preferences, moderation actions, and rate limits.
- Auth.js manages server sessions with Google OAuth. Only verified `gmail.com` and `googlemail.com` identities are accepted.
- Cloudinary stores authenticated item photos. Uploads are accepted only through the signed-in server route after report ownership, MIME type, size, and count checks.
- All application data access runs through Next.js server routes or server components. Authorization is checked by the app for every write and private read.

## Matching, ownership verification, and handover

1. Lost and found reports are compared using category, item terms, distinctive attributes, campus location, and date. Matches are suggestions only; new matches notify both report owners.
2. A member submits a private ownership claim against an open found-item report. The report is reserved while that claim is under review, preventing concurrent claims from racing.
3. The report owner reviews details that were not published in the listing. They may request more information, verify the claim, or decline it. Verification is a human decision by the report owner; Google sign-in confirms an account, not ownership of an item or university enrollment.
4. After verification, either participant can propose a staffed public-campus meeting. The other participant must confirm the location and time before the owner can mark the item returned.
5. Claim evidence and messages are readable only by the claimant and report owner. State changes, handover proposals, notifications, and report history are written together in MongoDB transactions.

## Local setup

1. Use Node.js 20.9 or newer and install dependencies with `npm install`.
2. Create a MongoDB Atlas database and allow the app host to connect. Create a database user with access only to the Campus Compass database.
3. Create a Google OAuth client. Configure the authorized redirect URI as `http://localhost:3000/api/auth/callback/google` locally; add the matching production URI after deployment.
4. Create a Cloudinary account and use an API key/secret with authenticated asset delivery enabled.
5. Copy `.env.example` to `.env.local` and fill in the values. Keep all secrets server-side; never use `NEXT_PUBLIC_` for secrets.
6. Start the app with `npm run dev`.

## Environment variables

`MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are required. Generate `AUTH_SECRET` with a cryptographically secure random value.

## Existing Supabase data

The application no longer needs Supabase at runtime. To retain existing data, export the `profiles`, `item_reports`, `report_photos`, `claims`, `claim_messages`, `claim_status_history`, `saved_items`, `notifications`, `member_preferences`, `status_history`, and `moderation_actions` tables as JSON arrays. Create `user-map.json` mapping each exported Supabase user UUID to that user’s Google email, and place it beside the table JSON files. For photos, download each private object and add its local path as `local_file` in the corresponding `report_photos.json` row. With the MongoDB and Cloudinary environment variables set, run `node scripts/import-supabase-export.mjs ./path/to/export`. IDs and report/claim links are preserved; user IDs become lowercased Google emails, which Auth.js uses as stable app IDs. Review imported counts, roles, and relationships before switching traffic. Do not delete old Supabase data until the import is reviewed.

## Checks

Run `npm run lint` and `npm run build` before deployment. Deploy only after setting all required environment variables and verifying Google OAuth, report posting, claims, private messages, owner/admin permissions, and authenticated photo delivery.
