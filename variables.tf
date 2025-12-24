variable "tags" {
  description = "Map of tags to assign to resources"
  type        = map(string)
  default     = {}
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
