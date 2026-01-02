# Testing Guide - Custom Login and SSO Features

This guide provides step-by-step instructions for testing the custom login page and SSO features.

## Prerequisites

Before testing, ensure:
- Infrastructure is deployed (`terraform apply` completed successfully)
- Sample data is seeded:
  ```bash
  ./scripts/seed-data.sh us-east-1 dev
  ./scripts/seed-applications.sh us-east-1 dev
  ```
- You have the OIDC issuer URL from Terraform outputs:
  ```bash
  ISSUER_URL=$(terraform output -raw oidc_issuer_url)
  echo $ISSUER_URL
  ```

## Test 1: Custom Login Page

### 1.1 Access the Login Page

Navigate to the authorization endpoint with a test client:

```bash
# Open in browser
echo "${ISSUER_URL}/auth?client_id=test-client&redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code&scope=openid+profile+email&state=test123"
```

**Expected Result:**
- You should be redirected to the custom S3-hosted login page
- The page should have a modern gradient design
- The form should contain username and password fields

### 1.2 Test Login with Valid Credentials

Enter the demo credentials:
- **Username**: `demo`
- **Password**: `password`

Click "Sign In"

**Expected Result:**
- Form submits to the `/auth` endpoint
- You are redirected to the landing page showing available applications

### 1.3 Test Login with Invalid Credentials

Try logging in with:
- **Username**: `demo`
- **Password**: `wrongpassword`

**Expected Result:**
- You are redirected back to the login page
- An error message is displayed: "Invalid username or password"

## Test 2: Application Selection Landing Page

After successful login from Test 1.2:

### 2.1 View Available Applications

**Expected Result:**
- Landing page displays with gradient header
- User info section shows: "Welcome, demo!"
- Email address is displayed if available
- Application cards are shown:
  - Test Application (🧪)
  - AWS Console (Development) (☁️)
  - Internal Dashboard (📊)
- Each card has:
  - Application icon
  - Application name
  - Description
  - Account badges (if applicable)

### 2.2 Select an Application

Click on "Test Application"

**Expected Result:**
- You are redirected to the `/complete-auth` endpoint
- An authorization code is generated
- You are redirected to `https://oauth.pstmn.io/v1/callback?code=...&state=test123`
- The authorization code is included in the URL

## Test 3: OAuth Flow Completion

### 3.1 Exchange Authorization Code for Tokens

Using curl or Postman, exchange the code from Test 2.2:

```bash
# Replace CODE with the authorization code from the redirect
CODE="your-authorization-code-here"

curl -X POST "${ISSUER_URL}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${CODE}" \
  -d "redirect_uri=https://oauth.pstmn.io/v1/callback" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret"
```

**Expected Result:**
```json
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 3.2 Verify Tokens

Decode the ID token at https://jwt.io or using:

```bash
echo "your-id-token" | cut -d. -f2 | base64 -d | jq .
```

**Expected Claims:**
- `sub`: User ID
- `iss`: Your issuer URL
- `aud`: `test-client`
- `exp`: Expiration timestamp
- `email`: User's email
- `name`: User's name

## Test 4: Application Management

### 4.1 Add a New Application

```bash
REGION="us-east-1"
ENV="dev"

aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-applications" \
  --item '{
    "application_id": {"S": "my-custom-app"},
    "name": {"S": "My Custom Application"},
    "description": {"S": "A custom application for testing"},
    "icon": {"S": "🚀"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "test-client"},
    "redirect_url": {"S": "https://myapp.com/callback"}
  }' \
  --region "$REGION"
```

### 4.2 Grant User Access

```bash
# Get demo user ID
USER_ID=$(aws dynamodb query \
  --table-name "oidc-provider-${ENV}-users" \
  --index-name username-index \
  --key-condition-expression "username = :username" \
  --expression-attribute-values '{":username":{"S":"demo"}}' \
  --query 'Items[0].user_id.S' \
  --output text \
  --region "$REGION")

# Grant access
aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-user-applications" \
  --item '{
    "user_id": {"S": "'"$USER_ID"'"},
    "application_id": {"S": "my-custom-app"},
    "accounts": {"L": []},
    "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }' \
  --region "$REGION"
```

### 4.3 Verify New Application Appears

Log in again through the authorization flow and check the landing page.

**Expected Result:**
- "My Custom Application" appears with a 🚀 icon
- The application is clickable and functional

## Test 5: Session Management

### 5.1 Verify Session Creation

After successful login, check the sessions table:

```bash
aws dynamodb scan \
  --table-name "oidc-provider-${ENV}-sessions" \
  --region "$REGION"
```

**Expected Result:**
- One or more session items exist
- Each session has:
  - `session_id`: Unique session identifier
  - `user_id`: Associated user ID
  - `client_id`: OAuth client ID
  - `expires_at`: Expiration timestamp (10 minutes from creation)

### 5.2 Test Session Expiration

Wait 11 minutes after creating a session, then try to access the landing page with the expired session token.

**Expected Result:**
- Error response: "Session expired"
- HTTP status: 401 Unauthorized

## Test 6: Multi-Application Scenario

### 6.1 Create Multiple Applications for Different Accounts

```bash
# Create AWS Console apps for different accounts
aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-applications" \
  --item '{
    "application_id": {"S": "aws-dev-account-123"},
    "name": {"S": "AWS Dev Account 123"},
    "description": {"S": "Development AWS account 123456789"},
    "icon": {"S": "☁️"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "aws-console"},
    "redirect_url": {"S": "https://signin.aws.amazon.com/federation"},
    "account_id": {"S": "123456789"},
    "account_name": {"S": "Dev Account"}
  }' \
  --region "$REGION"

aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-applications" \
  --item '{
    "application_id": {"S": "aws-prod-account-456"},
    "name": {"S": "AWS Prod Account 456"},
    "description": {"S": "Production AWS account 456789123"},
    "icon": {"S": "🔐"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "aws-console"},
    "redirect_url": {"S": "https://signin.aws.amazon.com/federation"},
    "account_id": {"S": "456789123"},
    "account_name": {"S": "Prod Account"}
  }' \
  --region "$REGION"
```

### 6.2 Grant User Access to Both Accounts

```bash
aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-user-applications" \
  --item '{
    "user_id": {"S": "'"$USER_ID"'"},
    "application_id": {"S": "aws-dev-account-123"},
    "accounts": {"L": [{"S": "Dev Account"}]},
    "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }' \
  --region "$REGION"

aws dynamodb put-item \
  --table-name "oidc-provider-${ENV}-user-applications" \
  --item '{
    "user_id": {"S": "'"$USER_ID"'"},
    "application_id": {"S": "aws-prod-account-456"},
    "accounts": {"L": [{"S": "Prod Account"}]},
    "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }' \
  --region "$REGION"
```

### 6.3 Test Account Selection

Log in through the authorization flow.

**Expected Result:**
- Landing page shows both AWS Console options
- Each shows the appropriate account badge (Dev Account, Prod Account)
- User can choose which account to access

## Test 7: Error Handling

### 7.1 Missing Client ID

Navigate to:
```
${ISSUER_URL}/auth?redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code
```

**Expected Result:**
- Error response: "Missing required parameters"
- HTTP status: 400

### 7.2 Invalid Client ID

Navigate to:
```
${ISSUER_URL}/auth?client_id=invalid-client&redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code
```

**Expected Result:**
- Error response: "Invalid client_id or redirect_uri"
- HTTP status: 400

### 7.3 Invalid Session Token

Try accessing the landing page with an invalid session:

```bash
curl "${ISSUER_URL}/landing" \
  -H "Authorization: Bearer invalid-session-token"
```

**Expected Result:**
```json
{
  "error": "unauthorized",
  "error_description": "Invalid or expired session"
}
```
- HTTP status: 401

## Test 8: UI/UX Validation

### 8.1 Mobile Responsiveness

Access the login and landing pages from a mobile device or browser developer tools mobile emulator.

**Expected Result:**
- Login page is fully responsive
- Landing page shows application cards in a single column on mobile
- All text is readable
- Buttons are easily clickable

### 8.2 Browser Compatibility

Test on multiple browsers:
- Chrome
- Firefox
- Safari
- Edge

**Expected Result:**
- All functionality works consistently across browsers
- CSS gradients render correctly
- Form submission works
- Redirects function properly

## Test 9: Performance Testing

### 9.1 Login Page Load Time

Measure the time to load the login page:

```bash
curl -w "@curl-format.txt" -o /dev/null -s "${LOGIN_PAGE_URL}"
```

Create `curl-format.txt`:
```
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_total:       %{time_total}\n
```

**Expected Result:**
- Total load time < 2 seconds
- DNS lookup < 100ms
- Connection time < 200ms

### 9.2 Landing Page API Response Time

```bash
# With valid session token
curl -w "Time: %{time_total}s\n" -o /dev/null -s \
  "${ISSUER_URL}/landing" \
  -H "Authorization: Bearer ${SESSION_TOKEN}"
```

**Expected Result:**
- Response time < 1 second
- Includes time for DynamoDB queries

## Test 10: Security Validation

### 10.1 HTTPS Enforcement

All endpoints should use HTTPS:
- Login page (S3)
- API Gateway endpoints

**Expected Result:**
- All resources served over HTTPS
- No mixed content warnings

### 10.2 Session Token Security

- Session tokens should be cryptographically random
- Tokens should be 32 bytes (base64url encoded)
- Tokens should expire after 10 minutes

### 10.3 CORS Headers

```bash
curl -X OPTIONS "${ISSUER_URL}/landing" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

**Expected Result:**
- Response includes appropriate CORS headers
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods` includes GET, POST, OPTIONS

## Troubleshooting

### Login page doesn't redirect

**Check:**
1. S3 bucket is public (policy allows GetObject)
2. Login page HTML file is uploaded
3. API Gateway URL is correctly templated in the HTML

### Landing page shows no applications

**Check:**
1. Applications table has entries
2. User-applications table has mappings for the user
3. Applications are enabled (`enabled: true`)

### Authorization code not working

**Check:**
1. Code hasn't expired (10-minute TTL)
2. Code hasn't been used already (single-use)
3. Client ID and redirect URI match exactly

### Session expired immediately

**Check:**
1. System clock is synchronized
2. DynamoDB TTL is properly configured
3. `expires_at` is set correctly (Unix timestamp in seconds)

## Success Criteria

All tests pass if:
- ✅ Login page loads and displays correctly
- ✅ Valid credentials successfully authenticate
- ✅ Invalid credentials show error message
- ✅ Landing page displays available applications
- ✅ Application selection completes authorization flow
- ✅ Tokens are issued and valid
- ✅ Session management works correctly
- ✅ Multiple applications/accounts can be configured
- ✅ Error handling is appropriate
- ✅ UI is responsive and works across browsers
- ✅ Performance meets expectations
- ✅ Security best practices are followed

## Next Steps

After successful testing:
1. Configure production OAuth clients
2. Set up AWS Console SSO (see AWS_CONSOLE_SSO.md)
3. Customize branding and styling
4. Implement additional security measures
5. Set up monitoring and alerting
6. Configure custom domain (optional)
