# S3 bucket for static assets
resource "aws_s3_bucket" "oidc_assets" {
  bucket = "${var.project_name}-${var.environment}-assets-${random_id.bucket_suffix.hex}"

  tags = {
    Name = "${var.project_name}-${var.environment}-assets"
  }
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# Block public access to S3 bucket
resource "aws_s3_bucket_public_access_block" "oidc_assets" {
  bucket = aws_s3_bucket.oidc_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "oidc_assets" {
  bucket = aws_s3_bucket.oidc_assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "oidc_assets" {
  bucket = aws_s3_bucket.oidc_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Bucket policy to allow Lambda access
resource "aws_s3_bucket_policy" "oidc_assets" {
  bucket = aws_s3_bucket.oidc_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowLambdaRead"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_exec.arn
        }
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.oidc_assets.arn,
          "${aws_s3_bucket.oidc_assets.arn}/*"
        ]
      }
    ]
  })
}
