# Example Node.js OIDC Client

This is a simple example client application that demonstrates how to integrate with the serverless OIDC provider.

## Setup

1. Make sure you've deployed the OIDC provider using Terraform
2. Get the OIDC issuer URL from Terraform outputs:
   ```bash
   cd ../..
   terraform output oidc_issuer_url
   ```

3. Seed the demo data (if not already done):
   ```bash
   cd ../..
   ./scripts/seed-data.sh
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Configure the client:
   ```bash
   export OIDC_ISSUER="https://your-api-gateway-url.amazonaws.com/dev"
   export CLIENT_ID="test-client"
   export CLIENT_SECRET="test-secret"
   export REDIRECT_URI="http://localhost:3000/callback"
   ```

   Or edit the configuration directly in `index.js`.

## Run

```bash
npm start
```

Open your browser and navigate to http://localhost:3000

## Usage

1. Click "Login with OIDC"
2. You'll be redirected to the OIDC provider login page
3. Login with demo credentials:
   - Username: `demo`
   - Password: `password`
4. You'll be redirected back to the client with user information

## How It Works

This example uses the `openid-client` library which:

1. Discovers the OIDC configuration from `/.well-known/openid-configuration`
2. Generates PKCE challenge for secure authorization
3. Redirects user to `/auth` endpoint
4. Handles the callback with authorization code
5. Exchanges code for tokens at `/token` endpoint
6. Fetches user info from `/userinfo` endpoint
7. Displays user information and tokens

## Code Flow

```
User -> Click Login
  -> Client generates PKCE challenge
  -> Redirect to /auth endpoint
  -> User authenticates
  -> Redirect back with authorization code
  -> Exchange code for tokens
  -> Fetch user info
  -> Display user profile
```

## Security Features

- PKCE (Proof Key for Code Exchange) for added security
- State parameter to prevent CSRF attacks
- Secure session storage
- Token validation using JWT

## Configuration Options

You can configure the client using environment variables:

- `OIDC_ISSUER`: The OIDC provider URL
- `CLIENT_ID`: OAuth client ID
- `CLIENT_SECRET`: OAuth client secret
- `REDIRECT_URI`: Callback URL for your application

## Production Considerations

For production use, you should:

1. Use HTTPS for all communication
2. Set `cookie.secure = true` in session configuration
3. Use a secure session secret
4. Implement proper error handling
5. Add token refresh logic
6. Store tokens securely (not in session for production)
7. Implement logout functionality with the provider
8. Add CSRF protection
9. Validate all inputs
10. Use environment-specific configuration
