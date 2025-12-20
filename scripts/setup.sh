#!/bin/bash
set -e

echo "Setting up OIDC Provider Lambda dependencies..."

# Navigate to Lambda source directory
cd lambda/src

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'terraform init' to initialize Terraform"
echo "2. Run 'terraform plan' to see what will be created"
echo "3. Run 'terraform apply' to deploy the infrastructure"
echo "4. Use scripts/seed-data.sh to add sample users and clients"
