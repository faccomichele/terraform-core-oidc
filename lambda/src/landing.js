const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const APPLICATIONS_TABLE = process.env.APPLICATIONS_TABLE;
const USER_APPLICATIONS_TABLE = process.env.USER_APPLICATIONS_TABLE;

/**
 * Landing page handler - Shows available applications for user
 */
exports.handler = async (event) => {
  console.log('Landing page request:', JSON.stringify(event));

  try {
    // Get session token from Authorization header or query params
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '') || event.queryStringParameters?.session;

    if (!sessionToken) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'unauthorized',
          error_description: 'No session token provided'
        })
      };
    }

    // Get session data
    const sessionResult = await docClient.send(new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { session_id: sessionToken }
    }));

    if (!sessionResult.Item) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'unauthorized',
          error_description: 'Invalid or expired session'
        })
      };
    }

    const session = sessionResult.Item;
    
    // Check if session is expired
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'unauthorized',
          error_description: 'Session expired'
        })
      };
    }

    // Get user data
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { user_id: session.user_id }
    }));

    if (!userResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'not_found',
          error_description: 'User not found'
        })
      };
    }

    const user = userResult.Item;

    // Get user's applications
    const userAppsResult = await docClient.send(new QueryCommand({
      TableName: USER_APPLICATIONS_TABLE,
      KeyConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: {
        ':userId': session.user_id
      }
    }));

    // Get application details for each user application
    const applications = [];
    for (const userApp of userAppsResult.Items || []) {
      const appResult = await docClient.send(new GetCommand({
        TableName: APPLICATIONS_TABLE,
        Key: { application_id: userApp.application_id }
      }));

      if (appResult.Item) {
        applications.push({
          id: appResult.Item.application_id,
          name: appResult.Item.name,
          description: appResult.Item.description,
          icon: appResult.Item.icon,
          enabled: appResult.Item.enabled !== false,
          accounts: userApp.accounts || [],
          redirect_url: appResult.Item.redirect_url,
          client_id: appResult.Item.client_id
        });
      }
    }

    // Return user info and applications
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          name: user.name || user.username
        },
        applications: applications,
        session: {
          client_id: session.client_id,
          redirect_uri: session.redirect_uri,
          state: session.state
        }
      })
    };

  } catch (error) {
    console.error('Landing page error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error'
      })
    };
  }
};
