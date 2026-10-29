# TRACE — AWS Cloud Architecture

![AWS Architecture](./aws-architecture.png)

Production deployment target for the TRACE lost & found platform. The current app is a static React SPA with local demo state; this architecture describes how it runs on AWS with a real backend, keeping the product’s core promise: **every return is verified by a person, and every handoff is recorded**.

## Service selection

| Concern | Service | Rationale |
| --- | --- | --- |
| SPA hosting | **S3 + CloudFront** | Static React build behind a CDN; versioned deploys; cheap and cacheable |
| DNS / TLS | **Route 53 + ACM** | Apex domain, managed certificates |
| Edge protection | **AWS WAF** | Rate limiting and bot rules on CloudFront |
| Authentication | **Amazon Cognito** | User pool; `admin` group for reviewers; JWT passed to the API |
| API | **API Gateway (HTTP API)** | Lambda proxy integration; JWT authorizer; throttling |
| Compute | **Lambda** | Items, claims, handoff, public GET — event-driven, no servers |
| Core data | **DynamoDB** | Items and claims; single-digit-ms access; PK/SK access patterns |
| Audit trail | **DynamoDB (separate table)** | Append-only; IAM denies update/delete |
| Media | **S3 (private bucket)** | Item photos; SSE; block public access; presigned upload URLs only |
| Match ranking | **EventBridge → Lambda** | Async ranking on report/claim events; stores **illustrative** scores only |
| Notifications | **SNS → SES** | Claim status and handoff emails; in-app notifications live in DynamoDB |
| Configuration | **SSM Parameter Store** | Feature flags and runtime config |
| Observability | **CloudWatch + X-Ray** | Logs, metrics, traces across API → Lambda → DynamoDB |

## How the services interact

### 1. Static delivery (flows 1, 3)

Browser requests hit **Route 53**, terminate TLS, and are served by **CloudFront** (with **WAF** in front). The React bundle comes from the private **S3 SPA** bucket via OAC. The SPA then calls the API over HTTPS with a Cognito JWT.

### 2. Authentication (flow 2)

Users sign in through **Cognito**. Successful sign-in returns JWT access/ID tokens. Admin reviewers belong to the `admin` group; handoff and claim-decision APIs reject tokens without it.

### 3. API and compute (flow 4)

**API Gateway** validates the JWT (public item GETs may be unauthenticated) and routes to Lambdas:

- **Items Fn** — create/search lost & found reports; generates presigned S3 URLs for photo upload; public GET strips private identifying details
- **Claims Fn** — submit claims with private ownership Q&A; status transitions `pending → under_review → approved | rejected`
- **Handoff Fn** — admin-only; confirms return, marks item `returned`, appends audit events
- **Public GET Fn** — read-only item view for QR landing pages

### 4. Persistence (flow 5)

Lambdas write to **DynamoDB** (items, claims) and the **audit table**. Photo bytes go straight from the browser to the **media S3 bucket** using presigned URLs — the API never proxies file uploads.

### 5. Async match ranking (flow 6)

`ItemReported` and `ClaimSubmitted` events are emitted to **EventBridge**. The **Match Ranking Lambda** scores candidates on description, category, date, and location, then writes **illustrative similarity scores** next to the claim/item. These scores are ranking aids only — they never transition status. A human admin must approve.

### 6. Notifications (flow 7)

Status changes publish to **SNS**, which delivers email via **SES** (claim received, approved, declined, ready for handoff). Unread in-app notifications are rows in DynamoDB scoped to the user.

### 7. Observability & config (flow 8)

All Lambdas and the API send logs and traces to **CloudWatch** and **X-Ray**. Runtime flags come from **SSM Parameter Store**.

## Security controls (on the diagram)

- Media bucket: **block public access**, SSE, presigned uploads only
- Cognito **admin group** gates handoff and claim decisions
- Audit table: IAM policy **denies** `UpdateItem` / `DeleteItem`
- Public item responses **never** include private identifying details or claim answers
- Match Lambda output is advisory; **approval is always human**

## Regenerating the PNG

```bash
npm run render:arch   # docs/aws-architecture.svg → docs/aws-architecture.png
```
