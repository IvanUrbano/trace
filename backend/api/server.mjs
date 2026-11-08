import http from 'node:http'
import pg from 'pg'
import { S3Client } from '@aws-sdk/client-s3'
import { createApp } from './app.mjs'
import { createCognitoVerifier } from './jwt.mjs'
import { PostgresRepository } from '../postgres/repository.mjs'

const env = process.env
const port = Number(env.PORT || 3000)
const maxBodyBytes = Number(env.MAX_BODY_BYTES || 262144)
const communityName = env.COMMUNITY_NAME || 'Mandaluyong'
const allowedOrigins = (env.ALLOWED_ORIGINS || 'https://main.d2oswv5myenb38.amplifyapp.com,http://localhost:5173')
  .split(',').map((value) => value.trim()).filter(Boolean)

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required')
if (!env.COGNITO_REGION || !env.COGNITO_USER_POOL_ID || !env.COGNITO_CLIENT_ID) {
  throw new Error('COGNITO_REGION, COGNITO_USER_POOL_ID, and COGNITO_CLIENT_ID are required')
}
if (!env.S3_BUCKET) throw new Error('S3_BUCKET is required')

const s3 = new S3Client({ region: env.S3_REGION || env.AWS_REGION || 'ap-southeast-1' })
const s3PublicBaseUrl = env.S3_PUBLIC_BASE_URL || `https://${env.S3_BUCKET}.s3.${env.S3_REGION || env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/`

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: Number(env.PG_POOL_MAX || 5) })
const repository = new PostgresRepository(pool)
const verifyToken = createCognitoVerifier({
  region: env.COGNITO_REGION,
  userPoolId: env.COGNITO_USER_POOL_ID,
  clientId: env.COGNITO_CLIENT_ID,
})
const app = createApp({ repository, verifyToken, communityName, allowedOrigins, maxBodyBytes, s3, s3Bucket: env.S3_BUCKET, s3PublicBaseUrl })

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')

  let response
  try {
    response = await app({
      method: req.method || 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers,
      body,
    })
  } catch {
    response = {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: { code: 'service_unavailable', message: 'Unexpected server error.', retryable: true } }),
    }
  }
  res.writeHead(response.status, response.headers)
  res.end(response.body)
})

server.listen(port, () => {
  console.log(`TRACE API listening on ${port}`)
})

const shutdown = () => {
  server.close(() => {
    pool.end().finally(() => process.exit(0))
  })
  setTimeout(() => process.exit(0), 10000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
