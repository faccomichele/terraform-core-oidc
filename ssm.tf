# SSM Parameter to store the OIDC issuer URL
# This breaks the circular dependency between Lambda and API Gateway
# The parameter is initially set with the user-provided issuer_url or a placeholder
# After deployment, it will be updated with the actual API Gateway URL if needed
resource "aws_ssm_parameter" "issuer_url" {
  name        = local.issuer_url_parameter
  description = "OIDC Issuer URL for the provider"
  type        = "String"
  overwrite   = true
  value       = local.issuer_url

  tags = {
    Name = "${local.project_name}-${local.environment}-issuer-url"
  }
}
