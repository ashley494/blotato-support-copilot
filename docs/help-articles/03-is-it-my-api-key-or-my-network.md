# My API key and URL look right, so why can't I connect to Blotato?

**Short answer:** If your request never reaches Blotato, the problem is the network between you and Blotato, not your key or your URL, and one quick check tells you which it is.

## How to tell

Network problems show up as errors with no status code, such as `ENOTFOUND`, `getaddrinfo`, `ECONNREFUSED`, `ETIMEDOUT`, "socket hang up" or a certificate error. A status code like 401, 403 or 404 means your request did reach Blotato.

## Fix it

1. **Check the address.** It should read exactly `https://backend.blotato.com/v2`. In the n8n Blotato credential, "Blotato Server" is `https://backend.blotato.com` with no `/v2`.
2. **Run the check below** from the same computer or server that runs your automation.
3. **If you get any status code, even 401,** your network is fine. Go back to your key and URL (see "Why am I getting a 401").
4. **If you get no status code,** turn off your VPN or try another network, such as your phone's hotspot, and run the check again.
5. **On a work network,** ask IT to allow `backend.blotato.com` on port 443. A certificate error usually means a proxy or security tool is sitting between you and Blotato.
6. **On self-hosted n8n,** run the check on the server or container that runs n8n, not your laptop.

## For API, n8n and Make users

```
curl -sS -o /dev/null -w "%{http_code}\n" https://backend.blotato.com/v2/users/me
```

You don't need your key for this. It prints `401` when the network is working. An error message instead of a number means the request never arrived.

**Still stuck?** Send support the exact error, where the request runs (n8n Cloud, self-hosted n8n, Make or your own code), what the check printed, and the time with your time zone. Never send your API key.
