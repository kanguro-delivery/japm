COMMIT_SHA := $(shell git rev-parse --short=9 HEAD)
PROD := 909589680768.dkr.ecr.eu-west-1.amazonaws.com/prod-japm-api
TEST := 909589680768.dkr.ecr.eu-west-1.amazonaws.com/test-japm-api

login-ecr-prod:
	aws ecr --profile kanguro --region eu-west-1 get-login-password | docker login --username AWS --password-stdin https://$(PROD)

build-prod: login-ecr-prod
	@echo "$(CYAN_COLOR)==> Build pre-production$(NO_COLOR)"
	docker buildx build --platform linux/amd64 -t test-japm-api -f Dockerfile.production .
	docker tag test-japm-api:latest $(PROD):$(COMMIT_SHA)
	docker push $(PROD):$(COMMIT_SHA)

login-ecr-test:
	aws ecr --profile kanguro --region eu-west-1 get-login-password | docker login --username AWS --password-stdin https://$(TEST)

build-test: login-ecr-test
	@echo "$(CYAN_COLOR)==> Build pre-production$(NO_COLOR)"
	docker buildx build --platform linux/amd64 -t test-japm-api -f Dockerfile.production .
	docker tag test-japm-api:latest $(TEST):$(COMMIT_SHA)
	docker push $(TEST):$(COMMIT_SHA)
