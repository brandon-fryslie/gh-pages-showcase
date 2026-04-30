// CORS+CORP proxy for GitHub Releases assets.
//
// Cross-origin-isolated pages (which CheerpX requires for SharedArrayBuffer)
// can only fetch resources whose responses include `Cross-Origin-Resource-Policy:
// cross-origin`. GitHub Releases redirects to release-assets.githubusercontent.com,
// which returns no CORP and no Access-Control-Allow-Origin — so a coi-serviceworker
// page cannot fetch them directly.
//
// This Worker receives requests at:
//
//     <worker-host>/<owner>/<repo>/releases/download/<tag>/<asset>
//
// forwards them to github.com (which 302s to release-assets), follows the redirect,
// and re-emits the response with permissive CORS+CORP headers. Range requests are
// passed through verbatim, so CheerpX's HTTP-byte-range disk-image streaming works.
//
// [LAW:single-enforcer] One proxy for the whole webvm pipeline. Every project that
// uses showcase-kit's WebVMTerminal points at this same Worker URL with their own
// owner/repo path. No per-project Worker.
//
// [LAW:dataflow-not-control-flow] Same operations every request: rewrite path,
// fetch upstream, copy body, set headers, return. The only branches are method
// validation (which is a guard, not a behaviour split).

const ALLOW_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export default {
  async fetch(request) {
    if (!ALLOW_METHODS.includes(request.method)) {
      return new Response('method not allowed', { status: 405 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    // Strip the leading slash; whatever remains is the GitHub path.
    // e.g. "/brandon-fryslie/ptydriver/releases/download/webvm-image-v1/ptydriver.ext2"
    const ghPath = url.pathname.replace(/^\/+/, '');
    if (!/^[\w.-]+\/[\w.-]+\/releases\/download\/[\w.-]+\/[\w.-]+$/.test(ghPath)) {
      return new Response(
        'expected path: /<owner>/<repo>/releases/download/<tag>/<asset>',
        { status: 400, headers: { 'content-type': 'text/plain' } },
      );
    }

    const upstream = `https://github.com/${ghPath}`;
    const forwardHeaders = new Headers();
    // Pass Range through verbatim — required for CheerpX's lazy block fetches.
    const range = request.headers.get('range');
    if (range) forwardHeaders.set('range', range);
    forwardHeaders.set('user-agent', 'showcase-kit-webvm-proxy');

    const upstreamResp = await fetch(upstream, {
      method: request.method,
      headers: forwardHeaders,
      redirect: 'follow',
    });

    // Build a response that copies the body but rewrites headers. Strip any
    // upstream COOP/COEP/CORP that conflict, then set our permissive set.
    const headers = new Headers(upstreamResp.headers);
    headers.delete('cross-origin-opener-policy');
    headers.delete('cross-origin-embedder-policy');
    for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers,
    });
  },
};

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-allow-headers': 'range, content-type',
    'access-control-expose-headers': 'content-length, content-range, accept-ranges, etag',
    'cross-origin-resource-policy': 'cross-origin',
  };
}
