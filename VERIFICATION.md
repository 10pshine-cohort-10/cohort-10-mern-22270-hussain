# Verification performed

## Assignment checkout — November 13, 2026

The bot-free application was imported into the assignment fork while preserving its original CodeRabbit configuration. Dependencies were installed in the new checkout. The backend/frontend tests, production build and MySQL integration check were rerun there. Database verification used an existing local test database via an environment configuration path; no private `.env` or database files are part of the submission. SonarQube analysis still requires a separately configured server and token.

Verified on November 10, 2026 using Node.js 24 and an official portable MySQL Community Server 8.4.13 running on 127.0.0.1:3307. The portable database and generated local credentials are outside the source archive or ignored by Git.

| Check                                                              | Result                                                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Mocha/Chai backend unit/controller tests                           | 8 passed                                                                                                          |
| Jest frontend tests, including real rich text editor serialization | 6 passed                                                                                                          |
| MySQL repository integration                                       | Passed                                                                                                            |
| Running-server smoke test                                          | Passed: authentication, rich CRUD, owner isolation, import/export, Socket.IO room isolation and logout revocation |
| Production React build                                             | Passed                                                                                                            |
| Production dependency audit                                        | 0 reported vulnerabilities                                                                                        |
| Browser                                                            | Registration, saved note persistence, narrow layout and desktop dashboard checked                                 |
| SonarQube                                                          | Configuration and CI integration supplied; scan and quality gate require a running SonarQube server and token     |

Coverage is not complete: measured backend statement coverage is about 94% for app/services/repository; measured frontend statement coverage is about 42%. Server startup and database migration files are excluded from unit coverage and exercised through integration/live checks. These results do not claim production deployment or a passing SonarQube gate.

MySQL ZIP source: [official Community Server downloads](https://dev.mysql.com/downloads/mysql/8.4.html?os=3). The downloaded ZIP checksum matched the vendor's published MD5 value. The portable server is for this workspace; a fresh checkout should use the Docker or existing-MySQL setup in README.md.
