COMMIT_SHA := $(shell git rev-parse --short=9 HEAD)
REPO := 909589680768.dkr.ecr.eu-west-1.amazonaws.com/test-japm-api

login-ecr:
	aws ecr --profile kanguro --region eu-west-1 get-login-password | docker login --username AWS --password-stdin https://$(REPO)

build-test: login-ecr
	@echo "$(CYAN_COLOR)==> Build pre-production$(NO_COLOR)"
	docker buildx build --platform linux/amd64 -t test-japm-api -f Dockerfile.production .
	docker tag test-japm-api:latest $(REPO):$(COMMIT_SHA)
	docker push $(REPO):$(COMMIT_SHA)

