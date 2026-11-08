import { createRemoteJWKSet, jwtVerify } from 'jose'

export function createCognitoVerifier({ region, userPoolId, clientId }) {
  if (!region || !userPoolId || !clientId) {
    throw new Error('Cognito verifier requires region, userPoolId, and clientId')
  }
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

  return async function verifyToken(token) {
    const { payload } = await jwtVerify(token, jwks, { issuer, algorithms: ['RS256'] })
    if (payload.token_use === 'access') {
      if (payload.client_id !== clientId) throw new Error('Invalid token audience')
    } else if (payload.token_use === 'id') {
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
      if (!audiences.includes(clientId)) throw new Error('Invalid token audience')
    } else {
      throw new Error('Unsupported token type')
    }
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Token has no subject')
    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'].filter((group) => typeof group === 'string') : []
    return {
      issuer,
      subject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      username: typeof payload['cognito:username'] === 'string' ? payload['cognito:username'] : undefined,
      groups,
    }
  }
}
