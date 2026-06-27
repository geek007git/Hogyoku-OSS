output "api_repository_url" {
  description = "ECR repository URL for the TypeScript API and worker image."
  value       = aws_ecr_repository.api.repository_url
}

output "docproc_repository_url" {
  description = "ECR repository URL for the Rust document-processing image."
  value       = aws_ecr_repository.docproc.repository_url
}

output "documents_bucket" {
  description = "Private S3 bucket for uploaded documents."
  value       = aws_s3_bucket.documents.bucket
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}
