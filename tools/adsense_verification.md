AdSense Ownership Verification

Options for verifying site ownership for AdSense:

1) HTML meta tag (place inside <head> of your site's homepage, e.g., index.html):

<meta name="google-site-verification" content="REPLACE_WITH_VERIFICATION_CODE" />

- When AdSense provides a meta tag, paste it into the <head> before the closing </head>.
- Do not remove the tag until verification completes.

2) DNS TXT record (preferred when you manage the domain DNS):

Create a TXT record for the domain (example):

Host/Name: @
Type: TXT
Value: google-site-verification=REPLACE_WITH_VERIFICATION_CODE
TTL: default

- Add the TXT record at your DNS provider, then in AdSense choose DNS verification and wait for propagation (can take minutes to hours).

Notes:
- Either method (meta or TXT) works; TXT is more robust for many setups.
- AdSense may also support adding a file to your webroot (HTML file) — follow AdSense instructions if provided.
- After verification, keep the meta tag or TXT record in place to avoid re-verification issues.

Suggested next step:
- If you want, I can insert a placeholder meta tag into `index.html` (commented) so you can replace the code easily when AdSense gives you the verification string.
