# Example Python OIDC Client

This is a simple example client application using Flask that demonstrates how to integrate with the serverless OIDC provider.

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

4. Create a virtual environment and install dependencies:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. Configure the client:
   ```bash
   export OIDC_ISSUER="https://your-api-gateway-url.amazonaws.com/dev"
   export CLIENT_ID="test-client"
   export CLIENT_SECRET="test-secret"
   export REDIRECT_URI="http://localhost:5000/callback"
   ```

   Or edit the configuration directly in `app.py`.

## Run

```bash
python app.py
```

Open your browser and navigate to http://localhost:5000

## Usage

1. Click "Login with OIDC"
2. You'll be redirected to the OIDC provider login page
3. Login with demo credentials:
   - Username: `demo`
   - Password: `password`
4. You'll be redirected back to the client with user information

## How It Works

This example uses the `authlib` library which:

1. Discovers the OIDC configuration from `/.well-known/openid-configuration`
2. Generates PKCE challenge for secure authorization
3. Redirects user to `/auth` endpoint
4. Handles the callback with authorization code
5. Exchanges code for tokens at `/token` endpoint
6. Fetches user info from the token or `/userinfo` endpoint
7. Displays user information

## Endpoints

- `/` - Home page
- `/login` - Initiate login flow
- `/callback` - OAuth callback endpoint
- `/logout` - Logout and clear session
- `/userinfo` - API endpoint to get user info (requires authentication)

## Dependencies

- **Flask**: Web framework
- **Authlib**: OAuth and OIDC client library
- **requests**: HTTP library

## Configuration Options

You can configure the client using environment variables:

- `OIDC_ISSUER`: The OIDC provider URL
- `CLIENT_ID`: OAuth client ID
- `CLIENT_SECRET`: OAuth client secret
- `REDIRECT_URI`: Callback URL for your application
- `SECRET_KEY`: Flask session secret key

## Production Considerations

For production use, you should:

1. Use HTTPS for all communication
2. Set a strong `SECRET_KEY` environment variable
3. Disable Flask debug mode
4. Use a production WSGI server (e.g., Gunicorn, uWSGI)
5. Implement proper error handling
6. Add token refresh logic
7. Store tokens securely
8. Add CSRF protection
9. Validate all inputs
10. Use environment-specific configuration

## Example with Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```
