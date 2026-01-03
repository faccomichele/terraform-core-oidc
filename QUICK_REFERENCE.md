# Quick Reference Guide

Quick commands and examples for common operations with the OIDC provider.

## Table of Contents
- [Deployment](#deployment)
- [User Management](#user-management)
- [Application Management](#application-management)
- [AWS Console SSO](#aws-console-sso)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Deployment

### Initial Setup
```bash
# Install dependencies
./scripts/setup.sh

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy infrastructure
terraform apply

# Seed sample data
./scripts/seed-data.sh us-east-1 dev
./scripts/seed-applications.sh us-east-1 dev

# Get outputs
terraform output
```

### Get Important URLs
```bash
# OIDC issuer URL
terraform output -raw oidc_issuer_url

# Login page URL
terraform output -raw login_page_url

# Landing page URL
terraform output -raw landing_page_url
```

## User Management

### Create User
Using Lambda function (recommended):
```bash
# Via AWS Console - invoke user-management Lambda with:
{
  "operation": "createUser",
  "username": "john",
  "password": "SecurePassword123!",
  "email": "john@example.com"
}
```

Using AWS CLI:
```bash
aws lambda invoke \
  --function-name oidc-provider-dev-user-management \
  --payload '{"operation":"createUser","username":"john","password":"SecurePassword123!","email":"john@example.com"}' \
  response.json
cat response.json
```

### Reset Password
```bash
aws lambda invoke \
  --function-name oidc-provider-dev-user-management \
  --payload '{"operation":"resetPassword","username":"john","newPassword":"NewSecurePassword123!"}' \
  response.json
```

### List Users
```bash
aws dynamodb scan \
  --table-name oidc-provider-dev-users \
  --query 'Items[*].[username.S, email.S, user_id.S]' \
  --output table
```

### Get User by Username
```bash
aws dynamodb query \
  --table-name oidc-provider-dev-users \
  --index-name username-index \
  --key-condition-expression "username = :username" \
  --expression-attribute-values '{":username":{"S":"john"}}' \
  --query 'Items[0]' \
  --output json
```

## Application Management

### Create Application
```bash
aws dynamodb put-item \
  --table-name oidc-provider-dev-applications \
  --item '{
    "application_id": {"S": "app-1"},
    "name": {"S": "My Application"},
    "description": {"S": "Application description"},
    "icon": {"S": "🚀"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "test-client"},
    "redirect_url": {"S": "https://app.com/callback"}
  }'
```

### List Applications
```bash
aws dynamodb scan \
  --table-name oidc-provider-dev-applications \
  --query 'Items[*].[name.S, application_id.S, enabled.BOOL]' \
  --output table
```

### Grant User Access to Application
```bash
# Get user ID
USER_ID=$(aws dynamodb query \
  --table-name oidc-provider-dev-users \
  --index-name username-index \
  --key-condition-expression "username = :username" \
  --expression-attribute-values '{":username":{"S":"john"}}' \
  --query 'Items[0].user_id.S' \
  --output text)

# Grant access
aws dynamodb put-item \
  --table-name oidc-provider-dev-user-applications \
  --item '{
    "user_id": {"S": "'"$USER_ID"'"},
    "application_id": {"S": "app-1"},
    "accounts": {"L": []},
    "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'
```

### Revoke User Access
```bash
aws dynamodb delete-item \
  --table-name oidc-provider-dev-user-applications \
  --key '{
    "user_id": {"S": "'"$USER_ID"'"},
    "application_id": {"S": "app-1"}
  }'
```

### Disable Application
```bash
aws dynamodb update-item \
  --table-name oidc-provider-dev-applications \
  --key '{"application_id": {"S": "app-1"}}' \
  --update-expression "SET enabled = :false" \
  --expression-attribute-values '{":false": {"BOOL": false}}'
```

## OAuth Client Management

### Create OAuth Client
```bash
aws dynamodb put-item \
  --table-name oidc-provider-dev-clients \
  --item '{
    "client_id": {"S": "my-client"},
    "client_secret": {"S": "'"$(openssl rand -base64 32)"'"},
    "redirect_uris": {"L": [
      {"S": "https://app.com/callback"}
    ]},
    "grant_types": {"L": [
      {"S": "authorization_code"},
      {"S": "refresh_token"}
    ]},
    "response_types": {"L": [{"S": "code"}]},
    "scope": {"S": "openid profile email"}
  }'
```

### List OAuth Clients
```bash
aws dynamodb scan \
  --table-name oidc-provider-dev-clients \
  --query 'Items[*].[client_id.S, redirect_uris.L[0].S]' \
  --output table
```

## AWS Console SSO

### Quick Setup
1. **Create IAM Identity Provider**:
```bash
ISSUER_URL=$(terraform output -raw oidc_issuer_url)
aws iam create-open-id-connect-provider \
  --url "$ISSUER_URL" \
  --client-id-list "aws-console" \
  --thumbprint-list "00000000000000000000000000000000000000000"
```

2. **Create IAM Role**:
```bash
# Save trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/${ISSUER_URL#https://}"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "${ISSUER_URL#https://}:aud": "aws-console"
      }
    }
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name OIDCConsoleAccess \
  --assume-role-policy-document file://trust-policy.json

# Attach permissions
aws iam attach-role-policy \
  --role-name OIDCConsoleAccess \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

3. **Register AWS Console Application**:
```bash
aws dynamodb put-item \
  --table-name oidc-provider-dev-applications \
  --item '{
    "application_id": {"S": "aws-console-main"},
    "name": {"S": "AWS Console"},
    "description": {"S": "AWS Management Console access"},
    "icon": {"S": "☁️"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "aws-console"},
    "redirect_url": {"S": "https://signin.aws.amazon.com/federation"},
    "role_arn": {"S": "arn:aws:iam::ACCOUNT_ID:role/OIDCConsoleAccess"}
  }'
```

For detailed instructions, see [AWS_CONSOLE_SSO.md](AWS_CONSOLE_SSO.md)

## Testing

### Test Login Flow
```bash
ISSUER_URL=$(terraform output -raw oidc_issuer_url)

# Open in browser
echo "${ISSUER_URL}/auth?client_id=test-client&redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code&scope=openid+profile+email&state=test123"

# Login with:
# Username: demo
# Password: password
```

### Test Token Exchange
```bash
# Replace CODE with authorization code from redirect
CODE="your-code-here"

curl -X POST "${ISSUER_URL}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${CODE}" \
  -d "redirect_uri=https://oauth.pstmn.io/v1/callback" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret"
```

### Test UserInfo Endpoint
```bash
# Replace TOKEN with access token
ACCESS_TOKEN="your-access-token"

curl "${ISSUER_URL}/userinfo" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

### Verify OIDC Configuration
```bash
curl "${ISSUER_URL}/.well-known/openid-configuration" | jq .
```

### Check JWKS
```bash
curl "${ISSUER_URL}/jwks" | jq .
```

## Troubleshooting

### Check Lambda Logs
```bash
# Auth Lambda logs
aws logs tail /aws/lambda/oidc-provider-dev-auth --follow

# Token Lambda logs
aws logs tail /aws/lambda/oidc-provider-dev-token --follow

# Landing Lambda logs
aws logs tail /aws/lambda/oidc-provider-dev-landing --follow
```

### Check DynamoDB Tables
```bash
# Check if user exists
aws dynamodb scan --table-name oidc-provider-dev-users | jq '.Items | length'

# Check if client exists
aws dynamodb scan --table-name oidc-provider-dev-clients | jq '.Items | length'

# Check active sessions
aws dynamodb scan --table-name oidc-provider-dev-sessions | jq '.Items | length'

# Check applications
aws dynamodb scan --table-name oidc-provider-dev-applications | jq '.Items | length'
```

### Verify S3 Bucket
```bash
BUCKET=$(terraform output -raw s3_assets_bucket_name)

# List files
aws s3 ls s3://${BUCKET}/

# Check login page
aws s3 cp s3://${BUCKET}/login.html - | head -20

# Check bucket policy
aws s3api get-bucket-policy --bucket ${BUCKET} | jq .
```

### Check API Gateway
```bash
# Get API ID
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='oidc-provider-dev-api'].id" --output text)

# List resources
aws apigateway get-resources --rest-api-id $API_ID | jq '.items[] | {path: .path, id: .id}'

# Get stage info
aws apigateway get-stage --rest-api-id $API_ID --stage-name dev | jq .
```

### Test Connectivity
```bash
# Test login page accessibility
curl -I $(terraform output -raw login_page_url)

# Test API Gateway
curl -I "${ISSUER_URL}/.well-known/openid-configuration"

# Test landing endpoint
curl -I "${ISSUER_URL}/landing"
```

### Decode JWT Token
```bash
# Decode ID token (requires jq)
echo "YOUR_ID_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# Verify signature online
# Visit https://jwt.io and paste your token
```

### Check IAM Permissions
```bash
# Check Lambda execution role
aws iam get-role --role-name oidc-provider-dev-lambda-exec | jq .

# List attached policies
aws iam list-attached-role-policies --role-name oidc-provider-dev-lambda-exec

# Get inline policies
aws iam list-role-policies --role-name oidc-provider-dev-lambda-exec
```

## Monitoring

### CloudWatch Metrics
```bash
# API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=oidc-provider-dev-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=oidc-provider-dev-auth \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Cleanup

### Remove All Data
```bash
# WARNING: This will delete all users, clients, applications, and sessions

# Scan and delete users
aws dynamodb scan --table-name oidc-provider-dev-users --query 'Items[*].user_id.S' --output text | \
  xargs -I {} aws dynamodb delete-item --table-name oidc-provider-dev-users --key '{"user_id": {"S": "{}"}}'

# Scan and delete applications
aws dynamodb scan --table-name oidc-provider-dev-applications --query 'Items[*].application_id.S' --output text | \
  xargs -I {} aws dynamodb delete-item --table-name oidc-provider-dev-applications --key '{"application_id": {"S": "{}"}}'
```

### Destroy Infrastructure
```bash
terraform destroy
```

## Additional Resources

- [README.md](README.md) - Main documentation
- [AWS_CONSOLE_SSO.md](AWS_CONSOLE_SSO.md) - AWS Console SSO setup guide
- [TESTING_SSO.md](TESTING_SSO.md) - Comprehensive testing guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - Architecture documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
