# One-off Railway job: deletes an Edge Function from the Supabase project and turns on leaked-password protection (Management API).
# Service variables: SUPABASE_ACCESS_TOKEN, FUNCTION_SLUG. Restart policy: Never.
FROM alpine:3.20
RUN apk add --no-cache curl bash
COPY deploy/delete-function/run.sh /run.sh
CMD ["bash", "/run.sh"]
