variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "oidc-provider"
}

variable "domain_name" {
  description = "Custom domain name for the OIDC provider (optional)"
  type        = string
  default     = ""
}

variable "issuer_url" {
  description = "OIDC issuer URL (will default to API Gateway URL if not provided)"
  type        = string
  default     = ""
}
