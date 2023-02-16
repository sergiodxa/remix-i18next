/**
 * Receives a Request or Headers objects.
 * If it's a Request returns the object directly
 * If it's a Headers returns the request.headers
 */
export function getHeaders(requestOrHeaders: Request | Headers): Headers {
  if (requestOrHeaders instanceof Headers) {
    return requestOrHeaders;
  }

  return requestOrHeaders.headers;
}
