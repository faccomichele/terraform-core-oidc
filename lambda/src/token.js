const {
  validateClient,
  getAuthCode,
  deleteAuthCode,
  getUserById,
  createJWT,
  createRefreshToken,
  getRefreshToken,
  deleteRefreshToken,
  createResponse,
  createErrorResponse
} = require('./utils');
const crypto = require('crypto');

// Parse Basic Auth header
function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }
  
  const base64Credentials = authHeader.substring(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [clientId, clientSecret] = credentials.split(':');
  
  return { clientId, clientSecret };
}

// Parse form data from request body
function parseFormData(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

// Verify PKCE code challenge
function verifyCodeChallenge(codeVerifier, codeChallenge, method) {
  if (!codeChallenge) return true; // PKCE not used
  
  if (!codeVerifier) return false;
  
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  } else if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
  
  return false;
}

exports.handler = async (event) => {
  try {
    const body = event.body;
    const isBase64 = event.isBase64Encoded;
    const decodedBody = isBase64 ? Buffer.from(body, 'base64').toString('utf-8') : body;
    const params = parseFormData(decodedBody);
    
    const {
      grant_type,
      code,
      redirect_uri,
      client_id: bodyClientId,
      client_secret: bodyClientSecret,
      code_verifier,
      refresh_token
    } = params;
    
    // Extract client credentials from Authorization header or body
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const basicAuth = parseBasicAuth(authHeader);
    
    const clientId = basicAuth?.clientId || bodyClientId;
    const clientSecret = basicAuth?.clientSecret || bodyClientSecret;
    
    // Validate required parameters
    if (!grant_type || !clientId) {
      return createErrorResponse('invalid_request', 'Missing required parameters');
    }
    
    // Handle authorization code grant
    if (grant_type === 'authorization_code') {
      if (!code || !redirect_uri) {
        return createErrorResponse('invalid_request', 'Missing code or redirect_uri');
      }
      
      // Validate client
      const client = await validateClient(clientId, clientSecret, redirect_uri);
      if (!client) {
        return createErrorResponse('invalid_client', 'Invalid client credentials');
      }
      
      // Get and validate authorization code
      const authCode = await getAuthCode(code);
      if (!authCode) {
        return createErrorResponse('invalid_grant', 'Invalid or expired authorization code');
      }
      
      // Verify code belongs to this client and redirect_uri
      if (authCode.client_id !== clientId || authCode.redirect_uri !== redirect_uri) {
        return createErrorResponse('invalid_grant', 'Authorization code mismatch');
      }
      
      // Check if code is expired
      if (authCode.expires_at < Math.floor(Date.now() / 1000)) {
        await deleteAuthCode(code);
        return createErrorResponse('invalid_grant', 'Authorization code expired');
      }
      
      // Verify PKCE if used
      if (authCode.code_challenge) {
        if (!verifyCodeChallenge(code_verifier, authCode.code_challenge, authCode.code_challenge_method)) {
          return createErrorResponse('invalid_grant', 'Invalid code_verifier');
        }
      }
      
      // Delete used authorization code
      await deleteAuthCode(code);
      
      // Get user
      const user = await getUserById(authCode.user_id);
      if (!user) {
        return createErrorResponse('invalid_grant', 'User not found');
      }
      
      // Create access token
      const accessTokenPayload = {
        sub: user.user_id,
        aud: clientId,
        scope: authCode.scope,
        iat: Math.floor(Date.now() / 1000)
      };
      const accessToken = await createJWT(accessTokenPayload, '1h');
      
      // Create ID token
      const idTokenPayload = {
        sub: user.user_id,
        aud: clientId,
        name: user.profile?.name || user.username,
        email: user.email,
        email_verified: user.email_verified || false,
        iat: Math.floor(Date.now() / 1000)
      };
      const idToken = await createJWT(idTokenPayload, '1h');
      
      // Create refresh token
      const refreshTokenId = await createRefreshToken(user.user_id, clientId, authCode.scope);
      
      return createResponse(200, {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: refreshTokenId,
        id_token: idToken,
        scope: authCode.scope
      });
      
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return createErrorResponse('invalid_request', 'Missing refresh_token');
      }
      
      // Validate client
      const client = await validateClient(clientId, clientSecret);
      if (!client) {
        return createErrorResponse('invalid_client', 'Invalid client credentials');
      }
      
      // Get refresh token
      const storedToken = await getRefreshToken(refresh_token);
      if (!storedToken) {
        return createErrorResponse('invalid_grant', 'Invalid refresh token');
      }
      
      // Verify token belongs to this client
      if (storedToken.client_id !== clientId) {
        return createErrorResponse('invalid_grant', 'Refresh token mismatch');
      }
      
      // Check if token is expired
      if (storedToken.expires_at < Math.floor(Date.now() / 1000)) {
        await deleteRefreshToken(refresh_token);
        return createErrorResponse('invalid_grant', 'Refresh token expired');
      }
      
      // Get user
      const user = await getUserById(storedToken.user_id);
      if (!user) {
        return createErrorResponse('invalid_grant', 'User not found');
      }
      
      // Create new access token
      const accessTokenPayload = {
        sub: user.user_id,
        aud: clientId,
        scope: storedToken.scope,
        iat: Math.floor(Date.now() / 1000)
      };
      const accessToken = await createJWT(accessTokenPayload, '1h');
      
      // Create new ID token
      const idTokenPayload = {
        sub: user.user_id,
        aud: clientId,
        name: user.profile?.name || user.username,
        email: user.email,
        email_verified: user.email_verified || false,
        iat: Math.floor(Date.now() / 1000)
      };
      const idToken = await createJWT(idTokenPayload, '1h');
      
      return createResponse(200, {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: idToken,
        scope: storedToken.scope
      });
      
    } else {
      return createErrorResponse('unsupported_grant_type', 'Grant type not supported');
    }
    
  } catch (error) {
    console.error('Error in token handler:', error);
    return createErrorResponse('server_error', 'Internal server error', 500);
  }
};
