const {
  validateClient,
  createErrorResponse,
  createHTMLResponse,
  verifyUserPassword
} = require('./utils');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const LOGIN_PAGE_URL = process.env.LOGIN_PAGE_URL;
const LANDING_PAGE_URL = process.env.LANDING_PAGE_URL;

// Parse form data from request body
function parseFormData(body) {
  const params = new URLSearchParams(body);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod || event.requestContext?.http?.method;
    let params;
    
    if (method === 'GET') {
      params = event.queryStringParameters || {};
    } else if (method === 'POST') {
      const body = event.body;
      const isBase64 = event.isBase64Encoded;
      const decodedBody = isBase64 ? Buffer.from(body, 'base64').toString('utf-8') : body;
      params = parseFormData(decodedBody);
    } else {
      return createErrorResponse('invalid_request', 'Method not allowed', 405);
    }
    
    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      username,
      password
    } = params;
    
    // Validate required parameters
    if (!client_id || !redirect_uri || !response_type) {
      return createErrorResponse('invalid_request', 'Missing required parameters');
    }
    
    // Validate client
    const client = await validateClient(client_id, null, redirect_uri);
    if (!client) {
      return createErrorResponse('invalid_client', 'Invalid client_id or redirect_uri');
    }
    
    // Only support authorization code flow
    if (response_type !== 'code') {
      return createErrorResponse('unsupported_response_type', 'Only response_type=code is supported');
    }
    
    // If GET request (no credentials), redirect to custom login page
    if (method === 'GET' || !username || !password) {
      // Build login page URL with parameters
      const loginUrl = new URL(LOGIN_PAGE_URL);
      loginUrl.searchParams.append('client_id', client_id);
      loginUrl.searchParams.append('redirect_uri', redirect_uri);
      loginUrl.searchParams.append('response_type', response_type);
      loginUrl.searchParams.append('scope', scope || 'openid profile email');
      if (state) loginUrl.searchParams.append('state', state);
      if (code_challenge) loginUrl.searchParams.append('code_challenge', code_challenge);
      if (code_challenge_method) loginUrl.searchParams.append('code_challenge_method', code_challenge_method);
      
      // Add API URL so the login page can POST back
      const apiUrl = getApiUrl(event);
      if (apiUrl) {
        loginUrl.searchParams.append('api_url', apiUrl);
      }
      
      return {
        statusCode: 302,
        headers: {
          'Location': loginUrl.toString(),
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        },
        body: ''
      };
    }
    
    // POST request with credentials - authenticate user
    const user = await verifyUserPassword(username, password);
    if (!user) {
      // Redirect back to login page with error
      const loginUrl = new URL(LOGIN_PAGE_URL);
      loginUrl.searchParams.append('client_id', client_id);
      loginUrl.searchParams.append('redirect_uri', redirect_uri);
      loginUrl.searchParams.append('response_type', response_type);
      loginUrl.searchParams.append('scope', scope || 'openid profile email');
      if (state) loginUrl.searchParams.append('state', state);
      if (code_challenge) loginUrl.searchParams.append('code_challenge', code_challenge);
      if (code_challenge_method) loginUrl.searchParams.append('code_challenge_method', code_challenge_method);
      loginUrl.searchParams.append('error', 'invalid_credentials');
      loginUrl.searchParams.append('error_description', 'Invalid username or password');
      
      // Add API URL
      const apiUrl = getApiUrl(event);
      if (apiUrl) {
        loginUrl.searchParams.append('api_url', apiUrl);
      }
      
      return {
        statusCode: 302,
        headers: {
          'Location': loginUrl.toString(),
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache'
        },
        body: ''
      };
    }
    
    // Create session for multi-step flow
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const sessionData = {
      session_id: sessionId,
      user_id: user.user_id,
      client_id: client_id,
      redirect_uri: redirect_uri,
      scope: scope || 'openid profile email',
      state: state,
      code_challenge: code_challenge,
      code_challenge_method: code_challenge_method,
      expires_at: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      created_at: new Date().toISOString()
    };
    
    await docClient.send(new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: sessionData
    }));
    
    // Redirect to landing page for application selection
    const landingUrl = new URL(LANDING_PAGE_URL);
    landingUrl.searchParams.append('session', sessionId);
    landingUrl.searchParams.append('client_id', client_id);
    landingUrl.searchParams.append('redirect_uri', redirect_uri);
    if (state) landingUrl.searchParams.append('state', state);
    
    // Add API URL for landing page
    const apiUrl = getApiUrl(event);
    if (apiUrl) {
      landingUrl.searchParams.append('api_url', apiUrl);
    }
    
    return {
      statusCode: 302,
      headers: {
        'Location': landingUrl.toString(),
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
      },
      body: ''
    };
    
  } catch (error) {
    console.error('Error in auth handler:', error);
    return createErrorResponse('server_error', 'Internal server error', 500);
  }
};

// Helper function to extract API URL from event
function getApiUrl(event) {
  try {
    // Get from request context
    const requestContext = event.requestContext;
    if (requestContext) {
      const domainName = requestContext.domainName;
      const stage = requestContext.stage;
      if (domainName && stage) {
        return `https://${domainName}/${stage}`;
      }
    }
    
    // Fallback: try to get from headers
    const host = event.headers?.Host || event.headers?.host;
    const stage = event.requestContext?.stage;
    if (host && stage) {
      return `https://${host}/${stage}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting API URL:', error);
    return null;
  }
}
