// CloudFront Function (viewer-request, cloudfront-js-2.0) for preview hosts.
// pr-<N>.preview.friquelme.dev serves the objects under pr-<N>/ in the preview
// bucket. The file has no exports so CloudFront can run it as is; the tests
// evaluate it and call handler(event).
var HOST_PATTERN = /^pr-[0-9]+\.preview\.friquelme\.dev$/;

function handler(event) {
  var request = event.request;
  var hostHeader = request.headers.host;
  var host = hostHeader ? hostHeader.value : '';

  if (!HOST_PATTERN.test(host)) {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }

  var prefix = '/' + host.split('.')[0];
  var uri = request.uri;

  if (uri.charAt(uri.length - 1) === '/') {
    request.uri = prefix + uri + 'index.html';
    return request;
  }

  // The production origin is an S3 website endpoint, which answers a
  // directory path without trailing slash (/blog) with a 302 to /blog/.
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
  if (lastSegment.indexOf('.') === -1) {
    return {
      statusCode: 302,
      statusDescription: 'Found',
      headers: { location: { value: uri + '/' } },
    };
  }

  request.uri = prefix + uri;
  return request;
}
