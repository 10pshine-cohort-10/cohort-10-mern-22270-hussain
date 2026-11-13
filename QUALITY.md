# Quality and acceptance checklist

## Automated checks

- `npm test`: Mocha/Chai HTTP controllers, services and repository boundaries; Jest API, filtering and React screen behavior. Generates separate backend/frontend LCOV reports.
- `npm run test:integration`: real MySQL persistence, owner isolation, update, transactional import and deletion. Requires `.env` and migrated schema; uses its own temporary user and cleans it up.
- `npm run build`: production React bundle.
- SonarQube: configured in `sonar-project.properties` and GitHub Actions. Assign JavaScript Sonar way profile and gate in the server UI; run the scanner with your server URL/token. A configuration file is not evidence that a scan passed.

## Manual acceptance flow

1. Register a new account and verify that the empty dashboard appears.
2. Create a note with a title, heading, bold text, a list and a chosen color. Save and reload; verify persistence.
3. Open the note, change it and save. Reopen to verify rich text round trips.
4. Change a note and cancel; confirm discarding. Verify saved content is unchanged.
5. Pin/unpin, search for content, filter a color, and check empty search results.
6. Open a second tab for the same account. Save in the first tab and verify the second updates.
7. Export JSON and import it. Verify imported copies and rich text.
8. Cancel deletion, then confirm deletion of a disposable note.
9. Check the profile and log out. Verify private APIs return 401. Log in again.
10. Register a second user. Confirm the first user's notes cannot be listed, exported, read, updated or deleted.
11. Repeat key screens on a narrow viewport; verify labels, keyboard focus and errors remain visible.

## Operational boundaries

This is a single Node process setup with a persistent MySQL database. Multiple Node instances would require a shared Socket.IO adapter. Logout revokes all sessions for the account. Concurrent editing uses last save wins; live updates refresh the list but preserve an open editor. JSON imports are atomic and capped at 500 notes and a 12 MB request body. No email verification, password recovery or account deletion flow was requested.
