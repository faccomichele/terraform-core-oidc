locals {
  environment          = split("_", terraform.workspace)[0]
  aws_region           = split("_", terraform.workspace)[1]
  project_name         = "oidc-provider"
  lambda_source_dir    = "${path.module}/lambda/src"
  issuer_url_parameter = "/${local.project_name}/${local.environment}/issuer-url"
}

locals {
  issuer_url = var.issuer_url != "" ? var.issuer_url : "https://${aws_api_gateway_rest_api.oidc.id}.execute-api.${local.aws_region}.amazonaws.com/${local.environment}"
}
