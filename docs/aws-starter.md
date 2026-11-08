# AWS starter path for TRACE

The current app stores report data in a browser-only demo for unauthenticated users. Deploy it with sample data only. Private claim answers and shared reports require a backend before public use. A Cognito user directory has been manually created in Asia Pacific (Singapore) for controlled testing. The environment-gated OIDC session now controls Sign In, My Account, and Sign Out and returns users to the requested route. In Cognito mode, old demo sessions are ignored and report/claim/dashboard/admin routes show an unavailable-online notice after sign-in. A local API (`backend/api/`) is deployed on EC2 at `https://54.254.106.234.sslip.io` and is connected to the frontend for report creation and photo upload when `VITE_API_BASE_URL` is set. Remaining mutations (claims, review, handoff) stay browser-demo only.

For local sign-in testing, fill the ignored `.env.local` from `.env.example`, including the managed-login domain. Register `http://localhost:5173/` in the app client's allowed callback URLs and allowed sign-out URLs; restart Vite. Open the homepage, select Sign In, then Continue to Sign In and use an invited test account. Confirm My Account and Sign Out work. Simulated browser tests pass, but the actual AWS login/logout and allowed sign-out configuration still need verification. See [aws-deployment-inventory.md](./aws-deployment-inventory.md).

Current priority is local workflow correctness and the Mandaluyong Community Board demo; AWS comes afterward. The board currently uses separate browser-local storage, with no shared posts, real moderation authority, or government partnership. A future backend must enforce author/admin permissions and confirmed persistence for posts as well as reports/claims. Do not expose the current demo admin shortcut as production authentication.

The local demo supports optional claimant-owned lost-report links, finder reference details, and self-review restrictions. A server-only PostgreSQL repository uses transactions and unique indexes for claim/handoff checks. A local HTTP API (`backend/api/`) now verifies Cognito JWTs, derives the actor identity and `admin` role from verified claims, validates bodies with the shared contract schemas, and calls that repository. Neither is connected to the React app yet. See [postgres-local.md](./postgres-local.md) for local tests and remaining security work.

Start with the [AWS service inventory](./aws-services.md): it explains each service's purpose and which additions can wait. Follow the detailed acceptance criteria in [AGENTS.md](../AGENTS.md).

Keep [aws-deployment-inventory.md](./aws-deployment-inventory.md) current whenever an AWS resource is created, changed, or deleted. It must not contain resource identifiers, credentials, or account details.

## Selected backend: one small EC2 instance

The account owner selected a single EC2 instance over API Gateway + Lambda + RDS. The instance runs Docker Compose: PostgreSQL, the Node API, a one-shot migration container, and Caddy for automatic HTTPS. Deployment files are in `deploy/ec2/`. This is cheaper and simpler for a demo, but the instance is a single point of failure and needs manual patching, backups, and monitoring.

1. In AWS Billing, confirm the Free plan credits/expiry and create an [AWS Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) alert (for example USD 5). Alerts do not cap spending. Do not promise a zero bill from generic Free Tier limits.
2. Launch one `t3.micro` EC2 instance with Amazon Linux 2023 in `ap-southeast-1`. Use a 20–30 GB gp3 volume. Allocate and associate an Elastic IP.
3. Create a security group: SSH (22) from your own IP only, HTTP (80) and HTTPS (443) from anywhere. Do not open PostgreSQL or the API port publicly.
4. Connect over SSH and clone `https://github.com/IvanUrbano/trace.git` to `/opt/trace`.
5. From the repository root run `sudo bash deploy/ec2/setup.sh`. It installs Docker and Compose, adds 2 GB of swap, and creates `deploy/ec2/.env` from the example.
6. Fill in `deploy/ec2/.env`: a long database password, `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `ALLOWED_ORIGINS` (the Amplify URL), and `SITE_ADDRESS`. With no custom domain, use the Elastic IP with sslip.io, for example `203.0.113.10.sslip.io`; Caddy obtains a Let's Encrypt certificate for it.
7. Start the stack: `sudo docker compose -f deploy/ec2/docker-compose.yml up -d --build`. The migration container applies the schema once. Check `https://<SITE_ADDRESS>/health` and that unauthenticated `/api/me/reports` returns 401.
8. Add `VITE_API_BASE_URL=https://<SITE_ADDRESS>` to the Amplify environment variables. The frontend API adapter exists, so report creation and photo upload flow through the live backend. Until then the deployed SPA keeps showing the unavailable-online notices.
9. Review logs, patch the OS, take PostgreSQL volume backups (`pg_dump`), and record cleanup steps before sharing the environment.

Then connect the frontend to the API, verify a regular user and an `admin` user on separate browsers, and confirm that private data stays private. Use one AWS Region for the backend. Add custom DNS, WAF, email delivery, or managed backups only when needed and cost-reviewed; each can add cost. The expanded alternative is in [architecture.md](./architecture.md).
