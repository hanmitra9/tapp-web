# One-off Railway job: points Supabase Auth's "Send Email" hook at tapp-mailer (Management API).
# Service variables: SUPABASE_ACCESS_TOKEN, HOOK_SECRET ("v1,whsec_..."), MAILER_HOOK_URL. Restart policy: Never.
FROM alpine:3.20
RUN apk add --no-cache curl jq bash
COPY deploy/auth-hook/run.sh /run.sh
CMD ["bash", "/run.sh"]
