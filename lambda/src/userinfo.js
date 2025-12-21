const {
  verifyJWT,
  getUserById,
  createResponse,
  createErrorResponse
} = require('./utils');

// Parse Bearer token from Authorization header
function parseBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7);
}

exports.handler = async (event) => {
  try {
    // Extract access token from Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const accessToken = parseBearerToken(authHeader);
    
    if (!accessToken) {
      return createErrorResponse('invalid_request', 'Missing access token', 401);
    }
    
    // Verify and decode the access token
    let decoded;
    try {
      decoded = await verifyJWT(accessToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return createErrorResponse('invalid_token', 'Invalid or expired access token', 401);
    }
    
    // Get user information
    const user = await getUserById(decoded.sub);
    if (!user) {
      return createErrorResponse('invalid_token', 'User not found', 401);
    }
    
    // Construct userinfo response based on scope
    const scopes = decoded.scope ? decoded.scope.split(' ') : ['openid'];
    const userInfo = {
      sub: user.user_id
    };
    
    // Add profile claims if profile scope is present
    if (scopes.includes('profile')) {
      userInfo.name = user.profile?.name || user.username;
      userInfo.given_name = user.profile?.given_name;
      userInfo.family_name = user.profile?.family_name;
      userInfo.middle_name = user.profile?.middle_name;
      userInfo.nickname = user.profile?.nickname;
      userInfo.preferred_username = user.username;
      userInfo.profile = user.profile?.profile_url;
      userInfo.picture = user.profile?.picture;
      userInfo.website = user.profile?.website;
      userInfo.gender = user.profile?.gender;
      userInfo.birthdate = user.profile?.birthdate;
      userInfo.zoneinfo = user.profile?.zoneinfo;
      userInfo.locale = user.profile?.locale;
      userInfo.updated_at = user.updated_at;
    }
    
    // Add email claims if email scope is present
    if (scopes.includes('email')) {
      userInfo.email = user.email;
      userInfo.email_verified = user.email_verified || false;
    }
    
    // Remove undefined values
    Object.keys(userInfo).forEach(key => {
      if (userInfo[key] === undefined) {
        delete userInfo[key];
      }
    });
    
    return createResponse(200, userInfo);
    
  } catch (error) {
    console.error('Error in userinfo handler:', error);
    return createErrorResponse('server_error', 'Internal server error', 500);
  }
};
