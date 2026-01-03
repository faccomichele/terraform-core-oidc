#!/bin/bash
set -e

# Seed Application Data Script
# This script seeds sample application and user-application mappings into DynamoDB

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <aws-region> <environment>"
    echo "Example: $0 us-east-1 dev"
    exit 1
fi

REGION=$1
ENV=$2

echo "Seeding application data for environment: $ENV in region: $REGION"
echo ""

# Table names
APPLICATIONS_TABLE="oidc-provider-${ENV}-applications"
USER_APPLICATIONS_TABLE="oidc-provider-${ENV}-user-applications"
USERS_TABLE="oidc-provider-${ENV}-users"

# Get demo user ID
echo "Looking up demo user..."
USER_ID=$(aws dynamodb query \
  --table-name "$USERS_TABLE" \
  --index-name username-index \
  --key-condition-expression "username = :username" \
  --expression-attribute-values '{":username":{"S":"demo"}}' \
  --query 'Items[0].user_id.S' \
  --output text \
  --region "$REGION" 2>/dev/null || echo "")

if [ -z "$USER_ID" ] || [ "$USER_ID" == "None" ]; then
    echo "Warning: Demo user not found. Creating applications anyway, but you'll need to create user-application mappings manually."
    USER_ID="user-demo"
fi

echo "User ID: $USER_ID"
echo ""

# Create sample applications
echo "Creating sample applications..."

# Application 1: Test Application
aws dynamodb put-item \
  --table-name "$APPLICATIONS_TABLE" \
  --item '{
    "application_id": {"S": "test-app"},
    "name": {"S": "Test Application"},
    "description": {"S": "Sample test application for development"},
    "icon": {"S": "🧪"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "test-client"},
    "redirect_url": {"S": "https://oauth.pstmn.io/v1/callback"}
  }' \
  --region "$REGION"

echo "✓ Created: Test Application"

# Application 2: AWS Console Dev
aws dynamodb put-item \
  --table-name "$APPLICATIONS_TABLE" \
  --item '{
    "application_id": {"S": "aws-console-dev"},
    "name": {"S": "AWS Console (Development)"},
    "description": {"S": "Development AWS account console access"},
    "icon": {"S": "☁️"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "aws-console"},
    "redirect_url": {"S": "https://signin.aws.amazon.com/federation"},
    "account_name": {"S": "Development"}
  }' \
  --region "$REGION"

echo "✓ Created: AWS Console (Development)"

# Application 3: AWS Console Prod (disabled by default)
aws dynamodb put-item \
  --table-name "$APPLICATIONS_TABLE" \
  --item '{
    "application_id": {"S": "aws-console-prod"},
    "name": {"S": "AWS Console (Production)"},
    "description": {"S": "Production AWS account console access - Contact admin for access"},
    "icon": {"S": "🔐"},
    "enabled": {"BOOL": false},
    "client_id": {"S": "aws-console"},
    "redirect_url": {"S": "https://signin.aws.amazon.com/federation"},
    "account_name": {"S": "Production"}
  }' \
  --region "$REGION"

echo "✓ Created: AWS Console (Production) - disabled"

# Application 4: Internal Dashboard
aws dynamodb put-item \
  --table-name "$APPLICATIONS_TABLE" \
  --item '{
    "application_id": {"S": "internal-dashboard"},
    "name": {"S": "Internal Dashboard"},
    "description": {"S": "Company internal metrics and analytics dashboard"},
    "icon": {"S": "📊"},
    "enabled": {"BOOL": true},
    "client_id": {"S": "dashboard-client"},
    "redirect_url": {"S": "https://dashboard.example.com/callback"}
  }' \
  --region "$REGION"

echo "✓ Created: Internal Dashboard"

echo ""
echo "Creating user-application mappings for demo user..."

# Grant demo user access to applications
if [ "$USER_ID" != "user-demo" ]; then
  # Test Application access
  aws dynamodb put-item \
    --table-name "$USER_APPLICATIONS_TABLE" \
    --item '{
      "user_id": {"S": "'"$USER_ID"'"},
      "application_id": {"S": "test-app"},
      "accounts": {"L": []},
      "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
    }' \
    --region "$REGION"

  echo "✓ Granted access: Test Application"

  # AWS Console Dev access
  aws dynamodb put-item \
    --table-name "$USER_APPLICATIONS_TABLE" \
    --item '{
      "user_id": {"S": "'"$USER_ID"'"},
      "application_id": {"S": "aws-console-dev"},
      "accounts": {"L": [{"S": "Development"}]},
      "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
    }' \
    --region "$REGION"

  echo "✓ Granted access: AWS Console (Development)"

  # Internal Dashboard access
  aws dynamodb put-item \
    --table-name "$USER_APPLICATIONS_TABLE" \
    --item '{
      "user_id": {"S": "'"$USER_ID"'"},
      "application_id": {"S": "internal-dashboard"},
      "accounts": {"L": []},
      "created_at": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
    }' \
    --region "$REGION"

  echo "✓ Granted access: Internal Dashboard"
else
  echo "⚠ Skipping user-application mappings - demo user not found"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Application data seeded successfully!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Sample applications created:"
echo "  • Test Application"
echo "  • AWS Console (Development)"
echo "  • AWS Console (Production) - disabled"
echo "  • Internal Dashboard"
echo ""
if [ "$USER_ID" != "user-demo" ]; then
  echo "Demo user ($USER_ID) has access to:"
  echo "  • Test Application"
  echo "  • AWS Console (Development)"
  echo "  • Internal Dashboard"
  echo ""
fi
echo "Next steps:"
echo "1. Test the login flow:"
echo "   Navigate to: \${ISSUER_URL}/auth?client_id=test-client&redirect_uri=https://oauth.pstmn.io/v1/callback&response_type=code&scope=openid+profile+email"
echo ""
echo "2. After login, you'll see the landing page with available applications"
echo ""
echo "3. For AWS Console SSO setup, see AWS_CONSOLE_SSO.md"
echo ""
echo "4. To add more users to applications:"
echo "   aws dynamodb put-item --table-name $USER_APPLICATIONS_TABLE --item '{...}'"
echo ""
