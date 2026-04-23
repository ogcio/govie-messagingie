security-privacy-report: 
	docker run --rm -v $(shell pwd):/tmp/scan bearer/bearer:2.0.1@sha256:f6701b1b6385c9e564efe680a8391cacc5e94798d7b719a21450064c26a7b2d9 scan --report privacy -f html /tmp/scan > bearer-privacy-report.html
security-scan: 
	docker run --rm -v $(shell pwd):/tmp/scan bearer/bearer:2.0.1@sha256:f6701b1b6385c9e564efe680a8391cacc5e94798d7b719a21450064c26a7b2d9 scan -f html /tmp/scan > bearer-scan-report.html

ci-install:
	pnpm install --frozen-lockfile

ci-lint:
	pnpm run lint

ci-unit-tests:
	@if [ -z "$(application)" ]; then \
		echo "Error: application argument is required. Usage: make ci-unit-tests application=<application>"; \
		exit 1; \
	fi

	node scripts/init-env.mjs
	pnpm --filter $(application) test

ci-smoke-tests:
	@if [ -z "$(application)" ]; then \
		echo "Error: application argument is required. Usage: make ci-smoke-tests application=<application>"; \
		exit 1; \
	fi

	pnpm install --frozen-lockfile
	pnpm --filter $(application) exec playwright install
	pnpm --filter $(application) run test:smoke:e2e
