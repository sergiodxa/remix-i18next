import { mock } from "bun:test";
import {
	type Params,
	type unstable_MiddlewareFunction,
	unstable_RouterContextProvider,
} from "react-router";

const defaultNext = mock().mockImplementation(() => Response.json(null));

interface RunMiddlewareOptions<T = Response> {
	request?: Request;
	params?: Params;
	context?: unstable_RouterContextProvider;
	next?: () => T | Promise<T>;
}

export async function runMiddleware<T = Response>(
	middleware: unstable_MiddlewareFunction<T>,
	{
		request = new Request("https://remix.utils"),
		context = new unstable_RouterContextProvider(),
		params = {},
		next = defaultNext,
	}: RunMiddlewareOptions<T> = {},
) {
	return await middleware({ request, params, context }, next);
}

export async function catchResponse<T>(promise: Promise<T>) {
	try {
		await promise;
		throw new Error("Expected promise to reject");
	} catch (exception) {
		if (exception instanceof Response) return exception;
		throw exception;
	}
}
