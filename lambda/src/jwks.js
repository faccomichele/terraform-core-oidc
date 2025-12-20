const { getSigningKeys, createResponse } = require('./utils');
const crypto = require('crypto');

// Convert PEM public key to JWK format
function pemToJwk(publicKeyPem, kid, alg = 'RS256') {
  // Extract the key from PEM format
  const key = crypto.createPublicKey(publicKeyPem);
  const jwk = key.export({ format: 'jwk' });
  
  return {
    kty: jwk.kty,
    use: 'sig',
    kid: kid,
    alg: alg,
    n: jwk.n,
    e: jwk.e
  };
}

exports.handler = async (event) => {
  try {
    const keys = await getSigningKeys();
    
    const jwk = pemToJwk(keys.public_key, keys.kid, keys.alg);
    
    const jwks = {
      keys: [jwk]
    };
    
    return createResponse(200, jwks);
  } catch (error) {
    console.error('Error in JWKS handler:', error);
    return createResponse(500, {
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
};
