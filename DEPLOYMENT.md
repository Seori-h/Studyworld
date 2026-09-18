# Deployment checklist

1. Generate and review `pnpm-lock.yaml`; run `pnpm run check` locally.
2. Apply database migrations to the DEV project and run the SQL tests.
3. Configure Google and Kakao OAuth redirect allowlists for the deployment origin.
4. Connect the private GitHub repository to Cloudflare Workers Builds.
5. Pin Cloudflare build pnpm to 12.4.2. Keep database/API credentials out of the build environment.
6. Bootstrap deploy the Worker. Add the four runtime secrets in Cloudflare Settings → Variables & Secrets, then redeploy.
7. Apply the same reviewed migrations to PROD.
8. Smoke-test public questions/leaderboard, guest scoring, OAuth, member room isolation, upload ownership and logout/session refresh.
9. Run Lighthouse against the production URL and fix accessibility/best-practice failures before launch.

A failed quality check or migration test is a release blocker. A fluctuating Lighthouse performance score alone is not used as an automatic deployment blocker, but 100 remains the optimization target.
