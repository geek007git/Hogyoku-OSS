variable "project" {
  description = "Project name used for resource naming."
  type        = string
  default     = "hogyoku"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for regional resources."
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "Existing VPC ID for ECS services."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks."
  type        = list(string)
}

variable "app_security_group_ids" {
  description = "Security groups attached to ECS tasks."
  type        = list(string)
}

variable "container_port" {
  description = "HTTP port exposed by the Hogyoku API container."
  type        = number
  default     = 4173
}

variable "web_desired_count" {
  description = "Number of web API tasks."
  type        = number
  default     = 2
}

variable "worker_desired_count" {
  description = "Number of ingestion worker tasks."
  type        = number
  default     = 1
}

variable "cpu" {
  description = "Fargate CPU units per task."
  type        = number
  default     = 1024
}

variable "memory" {
  description = "Fargate memory in MiB per task."
  type        = number
  default     = 2048
}

variable "app_origin" {
  description = "Public HTTPS origin for the web app."
  type        = string
}

variable "database_url" {
  description = "PostgreSQL URL stored in Secrets Manager."
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis URL stored in Secrets Manager."
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Gemini API key stored in Secrets Manager."
  type        = string
  sensitive   = true
  default     = ""
}

variable "session_secret" {
  description = "Opaque session secret stored in Secrets Manager."
  type        = string
  sensitive   = true
}
