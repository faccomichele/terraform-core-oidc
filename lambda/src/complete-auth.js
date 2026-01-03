const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const {
  validateClient,
  createAuthCode,
  createErrorResponse
} = require('./utils');

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const APPLICATIONS_TABLE = process.env.APPLICATIONS_TABLE;

/**
 * Complete authentication after application selection
 */
exports.handler = async (event) => {
  console.log('Complete auth request:', JSON.stringify(event));

  try {
    const params = event.queryStringParameters || {};
    const {
      session,
      application_id,
      account,
      client_id,
      redirect_uri,
      state
    } = params;

    if (!session) {
      return createErrorResponse('invalid_request', 'Missing session token');
    }

    // Get session data
    const sessionResult = await docClient.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { session_id: session }
    }));

    if (!sessionResult.Item) {
      return createErrorResponse('invalid_request', 'Invalid or expired session');
    }

    const sessionData = sessionResult.Item;

    // Check if session is expired
    if (sessionData.expires_at && sessionData.expires_at < Math.floor(Date.now() / 1000)) {
      return createErrorResponse('invalid_request', 'Session expired');
    }

    // Get application data if provided
    let applicationData = null;
    if (application_id) {
      const appResult = await docClient.send(new GetCommand({
        TableName: APPLICATIONS_TABLE,
        Key: { application_id }
      }));

      if (appResult.Item) {
        applicationData = appResult.Item;
      }
    }

    // Use client_id and redirect_uri from session or parameters
    const finalClientId = client_id || sessionData.client_id || applicationData?.client_id;
    const finalRedirectUri = redirect_uri || sessionData.redirect_uri || applicationData?.redirect_url;
    const finalState = state || sessionData.state;

    if (!finalClientId || !finalRedirectUri) {
      return createErrorResponse('invalid_request', 'Missing client_id or redirect_uri');
    }

    // Validate the client
    const client = await validateClient(finalClientId, finalRedirectUri);
    if (!client) {
      return createErrorResponse('invalid_client', 'Invalid client_id or redirect_uri');
    }

    // Create authorization code
    const code = await createAuthCode(
      sessionData.user_id,
      finalClientId,
      finalRedirectUri,
      sessionData.scope || 'openid profile email',
      sessionData.code_challenge,
      sessionData.code_challenge_method,
      application_id,
      account
    );

    // Build redirect URL with authorization code
    const redirectUrl = new URL(finalRedirectUri);
    redirectUrl.searchParams.append('code', code);
    if (finalState) {
      redirectUrl.searchParams.append('state', finalState);
    }

    // Return redirect response
    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl.toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        redirect_url: redirectUrl.toString()
      })
    };

  } catch (error) {
    console.error('Complete auth error:', error);
    return createErrorResponse('server_error', 'Internal server error');
  }
};
