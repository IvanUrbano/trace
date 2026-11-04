# AWS starter path for TRACE

The current app is a browser-only demo. Deploy it with sample data only. Real accounts, private claim answers, and shared reports require a backend before public use.

Start with the [AWS service inventory](./aws-services.md): it explains each service's purpose and which additions can wait. Follow the detailed acceptance criteria in [AGENTS.md](../AGENTS.md).

1. Define and test backend contracts, public/private responses, permission rules, and consistent claim/handoff operations locally. Keep the demo available through a separate data adapter.
2. In AWS Billing, check your actual Free Tier plan, credits, and expiry. Create an [AWS Budget](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) alert before creating resources; alerts do not cap spending.
3. Add reproducible infrastructure for [Cognito](https://aws.amazon.com/cognito/pricing/) sign-in, an [API Gateway HTTP API](https://aws.amazon.com/api-gateway/pricing/) with [Lambda](https://aws.amazon.com/lambda/pricing/) for authorization and claim decisions, [DynamoDB](https://aws.amazon.com/dynamodb/pricing/) for records/audit, and a private [S3](https://aws.amazon.com/s3/pricing/) bucket for photos. Include scoped IAM roles and CloudWatch logging. Evaluate Cognito Lite as the initial plan.
4. Run the existing match ranking in Lambda with bounded candidate queries. Keep ownership approval and handoff recording restricted to admins. Replace production `src/lib/store.tsx` browser persistence with API calls.
5. Commit and push the verified repository to GitHub. Connect that branch to [Amplify Hosting](https://aws.amazon.com/amplify/pricing/). Use `npm ci` and `npm run build`; the output folder is `dist`. Configure SPA rewrites, API origins, and Cognito callbacks. Verify direct item links, real sign-in, private data isolation, photo access, and the complete return workflow.

Use one AWS Region for the backend. Start with the Amplify default domain. Add custom DNS, WAF, application email delivery, and EventBridge only when their features are needed; each can add cost. The expanded alternative is in [architecture.md](./architecture.md).
