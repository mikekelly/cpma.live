.PHONY: deploy-website deploy-master deploy-assets deploy-proxy

deploy-website:
	cd website && npm run deploy

deploy-master:
	cd master-cf && npx wrangler deploy

deploy-assets:
	./scripts/upload-assets-r2.sh

deploy-proxy:
	cd proxy && cargo build --release
	@echo "Binary built at proxy/target/release/proxy"
	@echo "Upload to VPS: scp proxy/target/release/proxy root@<vps>:/opt/q3promode/proxy/q3proxy"
	@echo "Then restart:  ssh root@<vps> systemctl restart q3proxy"
